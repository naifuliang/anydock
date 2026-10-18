import { Hono, type Context } from "hono";
import { z } from "zod";
import { notifyDiscord } from "./discord.ts";
import { publish } from "./hub.ts";
import { textOnHandover } from "./inkbox.ts";
import { resolveTeammate } from "./people.ts";
import type { AppEnv, Env, User, WorkRow } from "./types.ts";

// Works API: upload sessions and their trajectories, share / hand over, inbox, live push.
export const works = new Hono<AppEnv>();

type Role = "owner" | "assignee" | "shared" | "project";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const normEmail = (e: string) => e.trim().toLowerCase();

works.use("*", async (c, next) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await claimPending(c.env.DB, session.user);
  await next();
});

// Shares and handovers can target an email before that person has an account.
// Once they sign in with that (verified) email, bind those rows to their user id.
async function claimPending(db: D1Database, user: User): Promise<void> {
  if (!user.emailVerified) return;
  const email = normEmail(user.email);
  await db.batch([
    db.prepare(`update "share" set "toUserId" = ?1 where "toUserId" is null and "toEmail" = ?2`).bind(user.id, email),
    db.prepare(`update "inboxItem" set "userId" = ?1 where "userId" is null and "toEmail" = ?2`).bind(user.id, email),
    db.prepare(`update "work" set "assigneeId" = ?1 where "assigneeId" is null and "assigneeEmail" = ?2`).bind(user.id, email),
  ]);
}

export async function roleFor(db: D1Database, work: WorkRow, userId: string): Promise<Role | null> {
  if (work.ownerId === userId) return "owner";
  if (work.assigneeId === userId) return "assignee";
  const shared = await db
    .prepare(`select 1 from "share" where "workId" = ?1 and "toUserId" = ?2 and "revokedAt" is null limit 1`)
    .bind(work.id, userId)
    .first();
  if (shared) return "shared";
  if (work.visibility === "project" && work.projectId) {
    const member = await db
      .prepare(`select 1 from "projectMember" where "projectId" = ?1 and "userId" = ?2`)
      .bind(work.projectId, userId)
      .first();
    if (member) return "project";
  }
  return null;
}

async function loadWork(c: Context<AppEnv>): Promise<{ work: WorkRow; role: Role } | Response> {
  const work = await c.env.DB.prepare(`select * from "work" where "id" = ?1`).bind(c.req.param("id")).first<WorkRow>();
  // Same 404 for missing and forbidden, so ids can't be probed.
  if (!work) return c.json({ error: "not_found" }, 404);
  const role = await roleFor(c.env.DB, work, c.get("user").id);
  if (!role) return c.json({ error: "not_found" }, 404);
  return { work, role };
}

// Everyone who should hear about changes to a work.
async function audience(db: D1Database, work: WorkRow): Promise<string[]> {
  const { results } = await db
    .prepare(
      `select "toUserId" as id from "share" where "workId" = ?1 and "toUserId" is not null and "revokedAt" is null
       union select "userId" from "projectMember" where ?2 = 'project' and "projectId" = ?3`,
    )
    .bind(work.id, work.visibility, work.projectId)
    .all<{ id: string }>();
  return [work.ownerId, ...(work.assigneeId ? [work.assigneeId] : []), ...results.map((r) => r.id)];
}

function workJson(work: WorkRow, role: Role) {
  const { trajectoryKey: _key, ...rest } = work;
  return { ...rest, role };
}

// ---------- works ----------

const upsertBody = z.object({
  source: z.enum(["claude-code", "codex"]),
  sessionId: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  cwd: z.string().max(1000).optional(),
  gitBranch: z.string().max(300).optional(),
  summary: z.string().max(50_000).optional(),
  method: z.string().max(100_000).optional(),
  visibility: z.enum(["private", "project", "shared"]).optional(),
  projectId: z.string().optional(),
  lastActivityAt: z.string().optional(),
});

// Create or update the caller's own work for one agent session (idempotent per source + sessionId).
works.put("/works", async (c) => {
  const parsed = upsertBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const b = parsed.data;
  const user = c.get("user");
  const db = c.env.DB;

  if (b.projectId) {
    const member = await db
      .prepare(`select 1 from "projectMember" where "projectId" = ?1 and "userId" = ?2`)
      .bind(b.projectId, user.id)
      .first();
    if (!member) return c.json({ error: "not_a_project_member" }, 403);
  }

  const ts = now();
  const work = await db
    .prepare(
      `insert into "work" ("id","ownerId","source","sessionId","title","cwd","gitBranch","summary","method",
         "visibility","projectId","lastActivityAt","createdAt","updatedAt")
       values (?1,?2,?3,?4,?5,?6,?7,?8,?9,coalesce(?10,'private'),?11,?12,?13,?13)
       on conflict ("ownerId","source","sessionId") do update set
         "title" = excluded."title",
         "cwd" = coalesce(excluded."cwd", "work"."cwd"),
         "gitBranch" = coalesce(excluded."gitBranch", "work"."gitBranch"),
         "summary" = coalesce(excluded."summary", "work"."summary"),
         "method" = coalesce(excluded."method", "work"."method"),
         "visibility" = coalesce(?10, "work"."visibility"),
         "projectId" = coalesce(excluded."projectId", "work"."projectId"),
         "lastActivityAt" = coalesce(excluded."lastActivityAt", "work"."lastActivityAt"),
         "updatedAt" = excluded."updatedAt"
       returning *`,
    )
    .bind(newId(), user.id, b.source, b.sessionId, b.title, b.cwd ?? null, b.gitBranch ?? null, b.summary ?? null,
      b.method ?? null, b.visibility ?? null, b.projectId ?? null, b.lastActivityAt ?? null, ts)
    .first<WorkRow>();
  // Artifacts the agent made in this session join its Work (and move with its shares and handovers).
  await c.env.DB.prepare(`update "artifact" set "workId" = ?1 where "workId" is null and "ownerId" = ?2 and "source" = ?3 and "sessionId" = ?4`)
    .bind(work!.id, work!.ownerId, work!.source, work!.sessionId).run();
  return c.json({ work: workJson(work!, "owner") });
});

// Mine, assigned to me, shared with me, and visible through my projects.
works.get("/works", async (c) => {
  const userId = c.get("user").id;
  const { results } = await c.env.DB.prepare(
    `select w.*, o."name" as "ownerName", o."email" as "ownerEmail", case
        when w."ownerId" = ?1 then 'owner'
        when w."assigneeId" = ?1 then 'assignee'
        when exists (select 1 from "share" s where s."workId" = w."id" and s."toUserId" = ?1 and s."revokedAt" is null) then 'shared'
        else 'project' end as "role"
     from "work" w join "user" o on o."id" = w."ownerId"
     where w."ownerId" = ?1 or w."assigneeId" = ?1
        or exists (select 1 from "share" s where s."workId" = w."id" and s."toUserId" = ?1 and s."revokedAt" is null)
        or (w."visibility" = 'project' and exists (
              select 1 from "projectMember" m where m."projectId" = w."projectId" and m."userId" = ?1))
     order by coalesce(w."lastActivityAt", w."updatedAt") desc
     limit 200`,
  )
    .bind(userId)
    .all<WorkRow & { role: Role }>();
  return c.json({ works: results.map(({ role, ...w }) => workJson(w, role)) });
});

works.get("/works/:id", async (c) => {
  const loaded = await loadWork(c);
  if (loaded instanceof Response) return loaded;
  const owner = await c.env.DB.prepare(`select "name", "email" from "user" where "id" = ?1`)
    .bind(loaded.work.ownerId)
    .first<{ name: string; email: string }>();
  return c.json({ work: { ...workJson(loaded.work, loaded.role), ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null } });
});

// ---------- trajectory ----------

const MAX_STEPS = 20_000;
const stepsBody = z.object({
  fromIndex: z.number().int().min(0),
  steps: z.array(z.record(z.string(), z.unknown())).max(5_000),
});

const trajectoryKey = (workId: string) => `works/${workId}/trajectory.json`;

async function readSteps(env: Env, work: WorkRow): Promise<unknown[]> {
  if (!work.trajectoryKey) return [];
  const obj = await env.TRAJECTORIES.get(work.trajectoryKey);
  return obj ? ((await obj.json()) as { steps: unknown[] }).steps : [];
}

// Live sync: the owner's client sends steps starting at fromIndex. Re-sending overlapping steps is safe;
// a gap (fromIndex beyond what we have) is rejected with the current count so the client can resend.
works.put("/works/:id/steps", async (c) => {
  const loaded = await loadWork(c);
  if (loaded instanceof Response) return loaded;
  const { work, role } = loaded;
  if (role !== "owner") return c.json({ error: "only_owner_uploads" }, 403);

  const parsed = stepsBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const { fromIndex, steps } = parsed.data;

  const existing = await readSteps(c.env, work);
  if (fromIndex > existing.length) return c.json({ error: "gap", stepCount: existing.length }, 409);
  const merged = existing.slice(0, fromIndex).concat(steps);
  if (merged.length > MAX_STEPS) return c.json({ error: "too_many_steps", max: MAX_STEPS }, 413);

  const key = trajectoryKey(work.id);
  await c.env.TRAJECTORIES.put(key, JSON.stringify({ steps: merged }), {
    httpMetadata: { contentType: "application/json" },
  });
  const ts = now();
  const updated = await c.env.DB.prepare(
    `update "work" set "trajectoryKey" = ?2, "stepCount" = ?3, "lastActivityAt" = ?4, "updatedAt" = ?4
     where "id" = ?1 returning *`,
  )
    .bind(work.id, key, merged.length, ts)
    .first<WorkRow>();

  c.executionCtx.waitUntil(
    audience(c.env.DB, updated!).then((ids) =>
      publish(c.env, ids, { type: "work.updated", workId: work.id, stepCount: merged.length, updatedAt: ts }),
    ),
  );
  return c.json({ stepCount: merged.length });
});

works.get("/works/:id/steps", async (c) => {
  const loaded = await loadWork(c);
  if (loaded instanceof Response) return loaded;
  const from = Math.max(0, Number(c.req.query("from") ?? 0) || 0);
  const limit = Math.min(2_000, Math.max(1, Number(c.req.query("limit") ?? 500) || 500));
  const steps = await readSteps(c.env, loaded.work);
  return c.json({ from, stepCount: steps.length, steps: steps.slice(from, from + limit) });
});

// ---------- share / handover ----------

const shareBody = z.object({
  to: z.string().min(1).max(200), // an email, or a teammate's name ("Jason") — see people.ts
  note: z.string().max(5_000).optional(),
});

async function createShare(c: Context<AppEnv>, kind: "share" | "handover") {
  const loaded = await loadWork(c);
  if (loaded instanceof Response) return loaded;
  const { work, role } = loaded;
  if (role !== "owner" && role !== "assignee") return c.json({ error: "forbidden" }, 403);

  const parsed = shareBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const me = c.get("user");
  const who = await resolveTeammate(c.env.DB, me.id, parsed.data.to);
  if ("error" in who) return c.json(who, 400);
  const toEmail = normEmail(who.email);
  if (toEmail === normEmail(me.email)) return c.json({ error: "cannot_share_with_self" }, 400);

  const db = c.env.DB;
  const recipient = await db.prepare(`select "id" from "user" where lower("email") = ?1`).bind(toEmail).first<{ id: string }>();
  const toUserId = recipient?.id ?? null;
  const ts = now();
  const shareId = newId();
  const inboxId = newId();
  const note = parsed.data.note ?? null;

  const stmts = [
    db.prepare(
      `insert into "share" ("id","workId","fromUserId","toUserId","toEmail","kind","note","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8)`,
    ).bind(shareId, work.id, me.id, toUserId, toEmail, kind, note, ts),
    db.prepare(
      `insert into "inboxItem" ("id","userId","toEmail","kind","workId","shareId","fromUserId","body","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8,?9)`,
    ).bind(inboxId, toUserId, toEmail, kind, work.id, shareId, me.id, note, ts),
    // A private work becomes "shared" once anyone else can see it.
    db.prepare(`update "work" set "visibility" = case when "visibility" = 'private' then 'shared' else "visibility" end, "updatedAt" = ?2 where "id" = ?1`)
      .bind(work.id, ts),
  ];
  if (kind === "handover") {
    stmts.push(
      db.prepare(`update "work" set "assigneeId" = ?2, "assigneeEmail" = ?3 where "id" = ?1`).bind(work.id, toUserId, toEmail),
    );
  }
  await db.batch(stmts);

  c.executionCtx.waitUntil(
    notifyDiscord(c.env, new URL(c.req.url).origin, work, { kind, actor: me.name || me.email, to: toEmail, note }),
  );
  if (toUserId && kind === "handover") {
    c.executionCtx.waitUntil(textOnHandover(c.env, toUserId, me.name || me.email, work.title, `${new URL(c.req.url).origin}/app#/w/${work.id}`));
  }
  if (toUserId) {
    const item = await inboxItemById(db, inboxId);
    c.executionCtx.waitUntil(publish(c.env, [toUserId], { type: "inbox.new", item }));
  }
  return c.json({ share: { id: shareId, workId: work.id, kind, toEmail, toUserId, note, createdAt: ts } }, 201);
}

works.post("/works/:id/share", (c) => createShare(c, "share"));
works.post("/works/:id/handover", (c) => createShare(c, "handover"));

works.get("/works/:id/shares", async (c) => {
  const loaded = await loadWork(c);
  if (loaded instanceof Response) return loaded;
  if (loaded.role !== "owner" && loaded.role !== "assignee") return c.json({ error: "forbidden" }, 403);
  const { results } = await c.env.DB.prepare(
    `select "id","kind","toEmail","toUserId","note","revokedAt","createdAt" from "share" where "workId" = ?1 order by "createdAt" desc`,
  )
    .bind(loaded.work.id)
    .all();
  return c.json({ shares: results });
});

// Revoke: whoever created the share, or the work's owner.
works.delete("/shares/:shareId", async (c) => {
  const db = c.env.DB;
  const me = c.get("user").id;
  const share = await db
    .prepare(`select s."id", s."fromUserId", w."ownerId" from "share" s join "work" w on w."id" = s."workId" where s."id" = ?1`)
    .bind(c.req.param("shareId"))
    .first<{ id: string; fromUserId: string; ownerId: string }>();
  if (!share || (share.fromUserId !== me && share.ownerId !== me)) return c.json({ error: "not_found" }, 404);
  await db.prepare(`update "share" set "revokedAt" = coalesce("revokedAt", ?2) where "id" = ?1`).bind(share.id, now()).run();
  return c.json({ ok: true });
});

// ---------- inbox ----------

const INBOX_SELECT = `
  select i."id", i."kind", i."body", i."readAt", i."createdAt", i."workId", i."shareId", i."artifactId",
         w."title" as "workTitle", w."source" as "workSource", a."title" as "artifactTitle", a."kind" as "artifactKind",
         u."name" as "fromName", u."email" as "fromEmail"
  from "inboxItem" i
  left join "work" w on w."id" = i."workId"
  left join "artifact" a on a."id" = i."artifactId"
  left join "user" u on u."id" = i."fromUserId"`;

async function inboxItemById(db: D1Database, id: string) {
  return db.prepare(`${INBOX_SELECT} where i."id" = ?1`).bind(id).first();
}

works.get("/inbox", async (c) => {
  const unreadOnly = c.req.query("unread") === "1";
  const { results } = await c.env.DB.prepare(
    `${INBOX_SELECT} where i."userId" = ?1 ${unreadOnly ? `and i."readAt" is null` : ""} order by i."createdAt" desc limit 100`,
  )
    .bind(c.get("user").id)
    .all();
  return c.json({ items: results });
});

works.post("/inbox/:itemId/read", async (c) => {
  await c.env.DB.prepare(`update "inboxItem" set "readAt" = coalesce("readAt", ?3) where "id" = ?1 and "userId" = ?2`)
    .bind(c.req.param("itemId"), c.get("user").id, now())
    .run();
  return c.json({ ok: true });
});

// ---------- live push ----------

// WebSocket stream of LiveEvents for the caller. Browsers authenticate with the session cookie;
// the CLI passes its bearer token as ?token= because WebSocket clients can't set headers.
works.get("/live", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") return c.json({ error: "expected_websocket" }, 426);
  const stub = c.env.HUB.get(c.env.HUB.idFromName(c.get("user").id));
  return stub.fetch(new Request("https://hub/connect", c.req.raw));
});
