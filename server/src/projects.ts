import { Hono } from "hono";
import { z } from "zod";
import { notifyDiscord } from "./discord.ts";
import type { AppEnv, WorkRow } from "./types.ts";

// Projects: a team space. Members see every work linked to it (work.visibility = 'project').
export const projects = new Hono<AppEnv>();

const now = () => new Date().toISOString();

projects.use("*", async (c, next) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});

async function membership(db: D1Database, projectId: string, userId: string) {
  return db
    .prepare(`select "role" from "projectMember" where "projectId" = ?1 and "userId" = ?2`)
    .bind(projectId, userId)
    .first<{ role: "owner" | "member" }>();
}

projects.post("/projects", async (c) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const id = crypto.randomUUID();
  const ts = now();
  const me = c.get("user").id;
  await c.env.DB.batch([
    c.env.DB.prepare(`insert into "project" ("id","name","ownerId","createdAt") values (?1,?2,?3,?4)`).bind(id, parsed.data.name, me, ts),
    c.env.DB.prepare(`insert into "projectMember" ("projectId","userId","role","createdAt") values (?1,?2,'owner',?3)`).bind(id, me, ts),
  ]);
  return c.json({ project: { id, name: parsed.data.name, role: "owner", memberCount: 1, workCount: 0, createdAt: ts } }, 201);
});

projects.get("/projects", async (c) => {
  const { results } = await c.env.DB.prepare(
    `select p."id", p."name", p."createdAt", m."role",
       (select count(*) from "projectMember" x where x."projectId" = p."id") as "memberCount",
       (select count(*) from "work" w where w."projectId" = p."id" and w."visibility" = 'project') as "workCount"
     from "project" p join "projectMember" m on m."projectId" = p."id" and m."userId" = ?1
     order by p."createdAt" desc`,
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ projects: results });
});

projects.get("/projects/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const mine = await membership(db, id, c.get("user").id);
  if (!mine) return c.json({ error: "not_found" }, 404);
  const project = await db.prepare(`select "id","name","ownerId","createdAt" from "project" where "id" = ?1`).bind(id).first();
  const members = await db
    .prepare(
      `select u."id", u."name", u."email", u."image", m."role", m."createdAt" from "projectMember" m join "user" u on u."id" = m."userId"
       where m."projectId" = ?1 order by m."role" desc, m."createdAt"`,
    )
    .bind(id)
    .all();
  const works = await db
    .prepare(
      `select w."id", w."title", w."source", w."stepCount", w."lastActivityAt", w."updatedAt", o."name" as "ownerName", o."email" as "ownerEmail"
       from "work" w join "user" o on o."id" = w."ownerId"
       where w."projectId" = ?1 and w."visibility" = 'project' order by coalesce(w."lastActivityAt", w."updatedAt") desc limit 200`,
    )
    .bind(id)
    .all();
  return c.json({ project: { ...project, role: mine.role }, members: members.results, works: works.results });
});

// Add a member by email. They need an AnyDock account (signing in once creates it).
projects.post("/projects/:id/members", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const mine = await membership(db, id, c.get("user").id);
  if (!mine) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ email: z.string().email() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const user = await db
    .prepare(`select "id","name","email" from "user" where lower("email") = ?1`)
    .bind(parsed.data.email.trim().toLowerCase())
    .first<{ id: string; name: string; email: string }>();
  if (!user) return c.json({ error: "no_account", message: "No AnyDock account with that email yet. Ask them to sign in at anydock.ai once." }, 404);
  await db
    .prepare(`insert or ignore into "projectMember" ("projectId","userId","role","createdAt") values (?1,?2,'member',?3)`)
    .bind(id, user.id, now())
    .run();
  return c.json({ member: { ...user, role: "member" } }, 201);
});

projects.delete("/projects/:id/members/:userId", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const me = c.get("user").id;
  const target = c.req.param("userId");
  const mine = await membership(db, id, me);
  // Owners remove anyone but themselves; members can only leave.
  if (!mine || (mine.role !== "owner" && target !== me)) return c.json({ error: "forbidden" }, 403);
  if (mine.role === "owner" && target === me) return c.json({ error: "owner_cannot_leave" }, 400);
  await db.prepare(`delete from "projectMember" where "projectId" = ?1 and "userId" = ?2`).bind(id, target).run();
  return c.json({ ok: true });
});

// Link (or unlink with null) one of my works to a project I belong to.
projects.put("/works/:id/project", async (c) => {
  const db = c.env.DB;
  const me = c.get("user").id;
  const work = await db.prepare(`select * from "work" where "id" = ?1`).bind(c.req.param("id")).first<WorkRow>();
  if (!work || work.ownerId !== me) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ projectId: z.string().nullable() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const { projectId } = parsed.data;
  if (projectId && !(await membership(db, projectId, me))) return c.json({ error: "not_a_project_member" }, 403);
  const hasShares = await db.prepare(`select 1 from "share" where "workId" = ?1 and "revokedAt" is null limit 1`).bind(work.id).first();
  const visibility = projectId ? "project" : hasShares ? "shared" : "private";
  await db
    .prepare(`update "work" set "projectId" = ?2, "visibility" = ?3, "updatedAt" = ?4 where "id" = ?1`)
    .bind(work.id, projectId, visibility, now())
    .run();
  if (projectId && projectId !== work.projectId) {
    const me = c.get("user");
    c.executionCtx.waitUntil(
      notifyDiscord(c.env, new URL(c.req.url).origin, { ...work, projectId, visibility }, { kind: "linked", actor: me.name || me.email }),
    );
  }
  return c.json({ ok: true, projectId, visibility });
});
