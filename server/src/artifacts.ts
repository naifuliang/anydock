import { Hono, type Context } from "hono";
import { z } from "zod";
import { publish } from "./hub.ts";
import { roomBroadcast } from "./room.ts";
import { hmacHex } from "./secure.ts";
import { isAgent } from "./trust.ts";
import type { AppEnv, Env, User, WorkRow } from "./types.ts";
import { roleFor } from "./works.ts";
import { resolveTeammate } from "./people.ts";

// Artifacts: what work produces. People and agents create, edit, share and hand them over; each keeps its history and
// (when made in an agent session) its Work, so "where did this come from?" has an answer.
//   doc / slides  live, sectioned Markdown: skeleton first (sections "todo"), then filled in; co-edited per section
//   sheet         live grid (JSON rows per tab), co-edited per cell; imports/exports .xlsx/.csv in the browser
//   latex / html  live source with preview (html runs sandboxed)
//   app           a small static web app (many files), served sandboxed at /u/…
//   file          any upload kept as-is with versions (Word, PowerPoint, Excel, PDF, images…), previewed in the browser
export const artifacts = new Hono<AppEnv>();

export type Kind = "doc" | "slides" | "sheet" | "latex" | "html" | "app" | "file";
export type ArtifactRow = {
  id: string; ownerId: string; title: string; kind: Kind; format: string; workId: string | null; source: string | null;
  sessionId: string | null; version: number; createdAt: string; updatedAt: string; updatedBy: string | null;
  publicToken?: string | null; publicAt?: string | null; publicSubmit?: number;
};
type SectionRow = {
  id: string; artifactId: string; position: number; heading: string; level: number; brief: string | null; body: string;
  status: string; lockedBy: string | null; lockedName: string | null; lockedUntil: string | null; updatedBy: string | null;
  updatedName: string | null; updatedAt: string;
};
type Access = "owner" | "edit" | "view";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const normEmail = (e: string) => e.trim().toLowerCase();
const LOCK_MS = 90_000;

artifacts.use("/artifacts/*", authed);
artifacts.use("/artifacts", authed);
const PUBLIC_READ = /^\/api\/artifacts\/[^/]+(\/files\/.+|\/versions|\/text)?$/;
async function authed(c: Context<AppEnv>, next: () => Promise<void>) {
  const session = c.get("session");
  // Public link: read-only GETs carrying the artifact's public token; load() checks the token itself.
  if (!session && c.req.method === "GET" && c.req.query("pt") && PUBLIC_READ.test(new URL(c.req.url).pathname)) return next();
  if (!session && c.req.method === "POST" && /^\/api\/artifacts\/[^/]+\/access-requests$/.test(new URL(c.req.url).pathname)) return c.json({ error: "unauthorized", message: "Sign in to AnyDock to request access." }, 401);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  // Shares to an email bind to the account once that person signs in with it.
  if (session.user.emailVerified) {
    await c.env.DB.prepare(`update "artifactShare" set "toUserId" = ?1 where "toUserId" is null and "toEmail" = ?2`).bind(session.user.id, normEmail(session.user.email)).run();
  }
  await next();
}

const actor = (c: Context<AppEnv>) => {
  const u = c.get("user");
  return { id: u.id, name: u.name || u.email.split("@")[0]!, via: isAgent(c) ? "agent" : "web" };
};

// ---------- access ----------

export async function artifactAccess(db: D1Database, a: ArtifactRow, userId: string): Promise<Access | null> {
  if (a.ownerId === userId) return "owner";
  const share = await db.prepare(`select "role" from "artifactShare" where "artifactId" = ?1 and "toUserId" = ?2`).bind(a.id, userId).first<{ role: string }>();
  let best: Access | null = share ? (share.role === "editor" ? "edit" : "view") : null;
  if (best !== "edit" && a.workId) {
    // It moves with its Work: whoever owns or was handed the work can edit; whoever it was shared with can read.
    const work = await db.prepare(`select * from "work" where "id" = ?1`).bind(a.workId).first<WorkRow>();
    const role = work ? await roleFor(db, work, userId) : null;
    if (role === "owner" || role === "assignee") best = "edit";
    else if (role && !best) best = "view";
  }
  return best;
}

async function load(c: Context<AppEnv>, need: Access): Promise<{ a: ArtifactRow; access: Access; viaLink?: boolean } | Response> {
  const a = await c.env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(c.req.param("id")).first<ArtifactRow>();
  if (!a) return c.json({ error: "not_found" }, 404);
  if (!c.get("session")) { // public link: view only, and only with this artifact's current token
    const pt = c.req.query("pt");
    if (need === "view" && pt && a.publicToken && pt === a.publicToken) return { a, access: "view" as Access, viaLink: true };
    return c.json({ error: "not_found" }, 404);
  }
  const access = await artifactAccess(c.env.DB, a, c.get("user").id);
  if (!access) { // signed in but not shared: the public link still gives a read-only view (and lets them request access)
    const pt = c.req.query("pt");
    if (need === "view" && c.req.method === "GET" && pt && a.publicToken && pt === a.publicToken) return { a, access: "view" as Access, viaLink: true };
    return c.json({ error: "not_found" }, 404);
  }
  const rank = { view: 0, edit: 1, owner: 2 };
  if (rank[access] < rank[need]) return c.json({ error: "forbidden", message: need === "owner" ? "Only the owner can do this." : "You can view this artifact but not edit it." }, 403);
  return { a, access };
}

async function audience(db: D1Database, a: ArtifactRow): Promise<string[]> {
  const ids = new Set<string>([a.ownerId]);
  const { results } = await db.prepare(`select "toUserId" from "artifactShare" where "artifactId" = ?1 and "toUserId" is not null`).bind(a.id).all<{ toUserId: string }>();
  results.forEach((r) => ids.add(r.toUserId));
  if (a.workId) {
    const w = await db.prepare(`select "ownerId","assigneeId" from "work" where "id" = ?1`).bind(a.workId).first<{ ownerId: string; assigneeId: string | null }>();
    if (w) { ids.add(w.ownerId); if (w.assigneeId) ids.add(w.assigneeId); }
  }
  return [...ids];
}

// The sandboxed origin for running HTML and small apps: a capability URL, so the iframe needs no cookies.
export const appSig = (env: Env, id: string) => hmacHex(env.BETTER_AUTH_SECRET, `artifact-app:${id}`).then((h) => h.slice(0, 32));
// What public-link visitors get instead: the same app, read-only (writes only while the owner accepts submissions).
export const appRoSig = (env: Env, id: string) => hmacHex(env.BETTER_AUTH_SECRET, `artifact-app-ro:${id}`).then((h) => h.slice(0, 32));
// Which capability a /u/<id>/<sig>/ URL carries: "rw" (people with access), "ro" (public link), or none.
export async function appCapability(env: Env, id: string, sig: string): Promise<"rw" | "ro" | null> {
  if (sig === (await appSig(env, id))) return "rw";
  if (sig === (await appRoSig(env, id))) return "ro";
  return null;
}
// Apps run on their own origin (USERCONTENT_ORIGIN, e.g. https://u.anydock.ai): a different site from AnyDock, so they
// can't read its cookies or call its API as the viewer, while still loading their own scripts and styles normally.
const contentOrigin = (env: Env, origin: string) => env.USERCONTENT_ORIGIN ?? origin;
const appUrl = async (env: Env, origin: string, a: ArtifactRow, viaLink = false) =>
  a.kind === "app" || a.kind === "html" ? `${contentOrigin(env, origin)}/u/${a.id}/${await (viaLink ? appRoSig : appSig)(env, a.id)}/` : null;

// ---------- markdown <-> sections ----------

export function splitMarkdown(md: string): { heading: string; level: number; body: string }[] {
  const out: { heading: string; level: number; body: string[] }[] = [];
  let fence = false;
  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && line.match(/^(#{1,2})\s+(.*)$/);
    if (m) out.push({ heading: m[2]!.trim(), level: m[1]!.length, body: [] });
    else {
      if (!out.length) out.push({ heading: "", level: 2, body: [] });
      out[out.length - 1]!.body.push(line);
    }
  }
  return out
    .map((s) => ({ heading: s.heading, level: s.level, body: s.body.join("\n").replace(/^\n+|\n+$/g, "") }))
    .filter((s) => s.heading || s.body);
}

export function joinSections(sections: Pick<SectionRow, "heading" | "level" | "body" | "brief" | "status">[]): string {
  return sections
    .map((s) => {
      const head = s.heading ? `${"#".repeat(Math.min(Math.max(s.level, 1), 2))} ${s.heading}\n\n` : "";
      const body = s.body || (s.status === "todo" && s.brief ? `<!-- todo: ${s.brief} -->` : "");
      return head + body;
    })
    .join("\n\n")
    .trim() + "\n";
}

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { rows[rows.length - 1]!.push(cur); cur = ""; }
    else if (ch === "\n") { rows[rows.length - 1]!.push(cur.replace(/\r$/, "")); cur = ""; rows.push([]); }
    else cur += ch;
  }
  rows[rows.length - 1]!.push(cur);
  if (rows.length > 1 && rows[rows.length - 1]!.length === 1 && rows[rows.length - 1]![0] === "") rows.pop();
  return rows;
}

// ---------- shared helpers ----------

async function sections(db: D1Database, id: string): Promise<SectionRow[]> {
  return (await db.prepare(`select * from "artifactSection" where "artifactId" = ?1 order by "position"`).bind(id).all<SectionRow>()).results;
}
async function latestFiles(db: D1Database, a: ArtifactRow) {
  return (await db.prepare(`select "id","path","contentType","size","version","createdAt" from "artifactFile" where "artifactId" = ?1 and "version" = ?2 order by "path"`)
    .bind(a.id, a.version).all()).results;
}
async function event(c: Context<AppEnv>, a: ArtifactRow, kind: string, detail: string | null, extra: Record<string, unknown> = {}) {
  const who = actor(c);
  const ts = now();
  await c.env.DB.batch([
    c.env.DB.prepare(`insert into "artifactEvent" ("id","artifactId","at","actorId","actorName","via","kind","detail") values (?1,?2,?3,?4,?5,?6,?7,?8)`)
      .bind(newId(), a.id, ts, who.id, who.name, who.via, kind, detail),
    c.env.DB.prepare(`update "artifact" set "updatedAt" = ?2, "updatedBy" = ?3 where "id" = ?1`).bind(a.id, ts, who.name),
  ]);
  c.executionCtx.waitUntil(roomBroadcast(c.env, a.id, { type: kind, by: who, at: ts, ...extra }).catch(() => {}));
}
const lockedByOther = (s: SectionRow, userId: string) => s.lockedBy && s.lockedBy !== userId && s.lockedUntil && s.lockedUntil > now();

function sectionRows(artifactId: string, list: { heading: string; level?: number; brief?: string | null; body?: string; status?: string }[], who: { id: string; name: string }, start = 0) {
  const ts = now();
  return list.map((s, i) => ({
    id: newId(), artifactId, position: start + i + 1, heading: s.heading, level: s.level ?? 2, brief: s.brief ?? null, body: s.body ?? "",
    status: s.status ?? (s.body ? "done" : "todo"), updatedBy: who.id, updatedName: who.name, updatedAt: ts,
  }));
}
const insertSection = (db: D1Database, r: ReturnType<typeof sectionRows>[number]) =>
  db.prepare(`insert into "artifactSection" ("id","artifactId","position","heading","level","brief","body","status","updatedBy","updatedName","updatedAt") values (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)`)
    .bind(r.id, r.artifactId, r.position, r.heading, r.level, r.brief, r.body, r.status, r.updatedBy, r.updatedName, r.updatedAt);

// ---------- create / list / read ----------

const outlineItem = z.union([z.string().min(1).max(300), z.object({ heading: z.string().max(300), brief: z.string().max(2000).optional(), level: z.number().int().min(1).max(2).optional(), body: z.string().max(200_000).optional() })]);
const createBody = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(["doc", "slides", "sheet", "latex", "html", "app", "file"]),
  format: z.string().max(20).optional(),
  outline: z.array(outlineItem).max(200).optional(),
  content: z.string().max(2_000_000).optional(),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(20_000).optional(),
  source: z.string().max(40).optional(),
  sessionId: z.string().max(200).optional(),
  workId: z.string().max(100).optional(),
});

artifacts.post("/artifacts", async (c) => {
  const parsed = createBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const me = c.get("user");
  const who = actor(c);
  const db = c.env.DB;
  const id = newId();
  const ts = now();
  const defaultFormat = { doc: "md", slides: "md", sheet: "csv", latex: "tex", html: "html", app: "html", file: "bin" }[d.kind];

  let workId: string | null = null;
  if (d.workId) {
    const w = await db.prepare(`select * from "work" where "id" = ?1`).bind(d.workId).first<WorkRow>();
    const role = w ? await roleFor(db, w, me.id) : null;
    if (role === "owner" || role === "assignee") workId = w!.id;
  } else if (d.source && d.sessionId) {
    const w = await db.prepare(`select "id" from "work" where "ownerId" = ?1 and "source" = ?2 and "sessionId" = ?3`).bind(me.id, d.source, d.sessionId).first<{ id: string }>();
    workId = w?.id ?? null;
  }

  const stmts = [
    db.prepare(`insert into "artifact" ("id","ownerId","title","kind","format","workId","source","sessionId","version","createdAt","updatedAt","updatedBy") values (?1,?2,?3,?4,?5,?6,?7,?8,1,?9,?9,?10)`)
      .bind(id, me.id, d.title, d.kind, d.format ?? defaultFormat, workId, d.source ?? null, d.sessionId ?? null, ts, who.name),
  ];
  let rows: ReturnType<typeof sectionRows> = [];
  if (d.kind === "doc" || d.kind === "slides") {
    const items = d.outline?.length
      ? d.outline.map((o) => (typeof o === "string" ? { heading: o } : o))
      : d.content ? splitMarkdown(d.content) : [];
    rows = sectionRows(id, items, who);
  } else if (d.kind === "sheet") {
    const data = d.rows ?? (d.content ? parseCsv(d.content) : [["", "", ""], ["", "", ""]]);
    rows = sectionRows(id, [{ heading: "Sheet1", body: JSON.stringify(data), status: "done" }], who);
  } else if (d.kind === "latex" || d.kind === "html") {
    rows = sectionRows(id, [{ heading: d.kind === "latex" ? "main.tex" : "index.html", body: d.content ?? "", status: d.content ? "done" : "todo" }], who);
  }
  rows.forEach((r) => stmts.push(insertSection(db, r)));
  stmts.push(db.prepare(`insert into "artifactEvent" ("id","artifactId","at","actorId","actorName","via","kind","detail") values (?1,?2,?3,?4,?5,?6,'created',?7)`)
    .bind(newId(), id, ts, who.id, who.name, who.via, rows.some((r) => r.status === "todo") ? `skeleton with ${rows.length} sections` : null));
  await db.batch(stmts);
  const a = (await db.prepare(`select * from "artifact" where "id" = ?1`).bind(id).first<ArtifactRow>())!;
  return c.json({ artifact: await artifactJson(c, a, "owner") }, 201);
});

async function artifactJson(c: Context<AppEnv>, a: ArtifactRow, access: Access, viaLink = false) {
  const origin = new URL(c.req.url).origin;
  const { publicToken, publicSubmit, ...rest } = a;
  // The public link is shown to people who can edit; everyone else (and public viewers) only learns whether it's public.
  const publicUrl = publicToken && access !== "view" ? `${origin}/p/${publicToken}` : null;
  return { ...rest, public: Boolean(publicToken), publicSubmit: Boolean(publicToken && publicSubmit), publicUrl, access, viaLink, url: `${origin}/a/${a.id}`, appUrl: await appUrl(c.env, origin, a, viaLink) };
}

// ---------- public links ----------

// Makes an artifact viewable by anyone with the link (keeps an existing link). Agents reach this only through an
// approved "artifact.publish" action; people turn it on from the Share panel.
export async function publishArtifact(env: Env, id: string, origin: string): Promise<string> {
  const a = await env.DB.prepare(`select "publicToken" from "artifact" where "id" = ?1`).bind(id).first<{ publicToken: string | null }>();
  let token = a?.publicToken;
  if (!token) {
    const b = new Uint8Array(18); crypto.getRandomValues(b);
    token = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await env.DB.prepare(`update "artifact" set "publicToken" = ?2, "publicAt" = ?3 where "id" = ?1`).bind(id, token, now()).run();
  }
  return `${origin}/p/${token}`;
}

artifacts.post("/artifacts/:id/public", async (c) => {
  const b = z.object({ on: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  if (!b.data.on) { // turning it off only narrows access: anyone who can edit, agents included
    const l = await load(c, "edit");
    if (l instanceof Response) return l;
    await c.env.DB.prepare(`update "artifact" set "publicToken" = null, "publicAt" = null where "id" = ?1`).bind(l.a.id).run();
    await event(c, l.a, "unpublished", null, {});
    return c.json({ ok: true, public: false });
  }
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  if (isAgent(c)) return c.json({ error: "needs_approval", message: "Making it public needs the person's OK: ask with anydock_artifact_publish (action artifact.publish)." }, 403);
  const url = await publishArtifact(c.env, l.a.id, new URL(c.req.url).origin);
  await event(c, l.a, "published", null, {});
  return c.json({ ok: true, public: true, publicUrl: url });
});

// Submissions: while on, public-link visitors of an app may add data and files (never edit, delete or act through
// its grants). Turning it on is the owner, in the browser, after a confirmation; turning it off anyone who can edit.
artifacts.post("/artifacts/:id/public-submit", async (c) => {
  const b = z.object({ on: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  const l = await load(c, b.data.on ? "owner" : "edit");
  if (l instanceof Response) return l;
  if (b.data.on) {
    if (isAgent(c)) return c.json({ error: "human_required", message: "Only the owner can let the public submit, from the artifact page." }, 403);
    if (l.a.kind !== "app" && l.a.kind !== "html") return c.json({ error: "not_an_app", message: "Only apps take submissions." }, 400);
    if (!l.a.publicToken) return c.json({ error: "not_public", message: "Turn on the public link first." }, 400);
  }
  await c.env.DB.prepare(`update "artifact" set "publicSubmit" = ?2 where "id" = ?1`).bind(l.a.id, b.data.on ? 1 : 0).run();
  await event(c, l.a, b.data.on ? "submissions.on" : "submissions.off", null, {});
  return c.json({ ok: true, publicSubmit: b.data.on });
});

// ---------- access requests (from a public link) ----------

type AccessRequestRow = { id: string; artifactId: string; userId: string; role: string; note: string | null; status: string; decidedRole: string | null; createdAt: string; decidedAt: string | null };

// Anyone signed in who holds the public link may ask; the owner decides. One pending request per person.
artifacts.post("/artifacts/:id/access-requests", async (c) => {
  const b = z.object({ pt: z.string().min(1), role: z.enum(["viewer", "editor"]).default("editor"), note: z.string().max(1000).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", message: 'Send {"pt": "<public link token>", "role": "editor" | "viewer", "note"?}' }, 400);
  const db = c.env.DB, me = c.get("user");
  const a = await db.prepare(`select * from "artifact" where "id" = ?1`).bind(c.req.param("id")).first<ArtifactRow>();
  if (!a || !a.publicToken || a.publicToken !== b.data.pt) return c.json({ error: "not_found" }, 404);
  const have = await artifactAccess(db, a, me.id);
  if (have === "owner" || have === "edit" || (have === "view" && b.data.role === "viewer")) return c.json({ error: "already_has_access", access: have }, 409);
  const pending = await db.prepare(`select * from "artifactAccessRequest" where "artifactId" = ?1 and "userId" = ?2 and "status" = 'pending'`).bind(a.id, me.id).first<AccessRequestRow>();
  if (pending) return c.json({ request: { id: pending.id, role: pending.role, status: "pending" } });
  const id = newId(), ts = now(), inboxId = newId();
  const owner = await db.prepare(`select "email" from "user" where "id" = ?1`).bind(a.ownerId).first<{ email: string }>();
  await db.batch([
    db.prepare(`insert into "artifactAccessRequest" ("id","artifactId","userId","role","note","status","createdAt") values (?1,?2,?3,?4,?5,'pending',?6)`).bind(id, a.id, me.id, b.data.role, b.data.note ?? null, ts),
    db.prepare(`insert into "inboxItem" ("id","userId","toEmail","kind","workId","artifactId","fromUserId","body","createdAt") values (?1,?2,?3,'artifact.access_request',null,?4,?5,?6,?7)`)
      .bind(inboxId, a.ownerId, owner?.email ?? "", a.id, me.id, `Asks to ${b.data.role === "editor" ? "edit" : "view"}${b.data.note ? ": " + b.data.note : ""}`, ts),
  ]);
  const item = { id: inboxId, kind: "artifact.access_request", artifactId: a.id, artifactTitle: a.title, workId: null, fromName: me.name || me.email, body: `Asks to ${b.data.role === "editor" ? "edit" : "view"}`, createdAt: ts };
  c.executionCtx.waitUntil(publish(c.env, [a.ownerId], { type: "inbox.new", item }).catch(() => {}));
  await event(c, a, "access.requested", `${me.email} (${b.data.role})`, {});
  return c.json({ request: { id, role: b.data.role, status: "pending" } }, 201);
});

artifacts.get("/artifacts/:id/access-requests", async (c) => {
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  const { results } = await c.env.DB.prepare(`select r."id", r."role", r."note", r."createdAt", u."name", u."email" from "artifactAccessRequest" r join "user" u on u."id" = r."userId"
    where r."artifactId" = ?1 and r."status" = 'pending' order by r."createdAt"`).bind(l.a.id).all();
  return c.json({ requests: results });
});

// The owner, in the browser: approve (as editor or viewer, defaulting to what they asked for) or decline.
artifacts.post("/artifacts/:id/access-requests/:rid", async (c) => {
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  if (isAgent(c)) return c.json({ error: "human_required", message: "The owner decides access requests on the artifact page." }, 403);
  const b = z.object({ approve: z.boolean(), role: z.enum(["viewer", "editor"]).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  const db = c.env.DB;
  const r = await db.prepare(`select * from "artifactAccessRequest" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("rid"), l.a.id).first<AccessRequestRow>();
  if (!r) return c.json({ error: "not_found" }, 404);
  if (r.status !== "pending") return c.json({ error: "already_decided", status: r.status }, 409);
  const role = (b.data.role ?? r.role) as "viewer" | "editor";
  const ts = now();
  await db.prepare(`update "artifactAccessRequest" set "status" = ?2, "decidedRole" = ?3, "decidedAt" = ?4 where "id" = ?1`).bind(r.id, b.data.approve ? "approved" : "declined", b.data.approve ? role : null, ts).run();
  await db.prepare(`update "inboxItem" set "readAt" = ?3 where "artifactId" = ?1 and "fromUserId" = ?2 and "kind" = 'artifact.access_request' and "readAt" is null`).bind(l.a.id, r.userId, ts).run().catch(() => {});
  const who = await db.prepare(`select "email" from "user" where "id" = ?1`).bind(r.userId).first<{ email: string }>();
  if (b.data.approve && who) {
    await shareTo(c, l.a, who.email, role, "artifact.share", "Your access request was approved.");
    await event(c, l.a, "shared", `${who.email} (${role}, requested)`);
  } else await event(c, l.a, "access.declined", who?.email ?? null, {});
  return c.json({ ok: true, status: b.data.approve ? "approved" : "declined", role: b.data.approve ? role : null });
});

artifacts.get("/artifacts", async (c) => {
  const me = c.get("user").id;
  const workId = c.req.query("workId");
  // Mine, shared with me, or attached to a work I can see.
  const { results } = await c.env.DB.prepare(
    `select a.*, u."name" as "ownerName", u."email" as "ownerEmail" from "artifact" a join "user" u on u."id" = a."ownerId"
     where (?2 is null or a."workId" = ?2) and (
       a."ownerId" = ?1
       or a."id" in (select "artifactId" from "artifactShare" where "toUserId" = ?1)
       or a."workId" in (select "id" from "work" where "ownerId" = ?1 or "assigneeId" = ?1)
       or a."workId" in (select "workId" from "share" where "toUserId" = ?1 and "revokedAt" is null)
       or a."workId" in (select w."id" from "work" w join "projectMember" m on m."projectId" = w."projectId" where w."visibility" = 'project' and m."userId" = ?1))
     order by a."updatedAt" desc limit 200`,
  ).bind(me, workId ?? null).all<ArtifactRow & { ownerName: string; ownerEmail: string }>();
  const origin = new URL(c.req.url).origin;
  return c.json({ artifacts: results.map((a) => ({ ...a, url: `${origin}/a/${a.id}` })) });
});

artifacts.get("/artifacts/:id", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const db = c.env.DB;
  const [secs, files, shares, events, work, owner] = await Promise.all([
    sections(db, l.a.id),
    latestFiles(db, l.a),
    db.prepare(`select s."id", s."toEmail", s."role", u."name" from "artifactShare" s left join "user" u on u."id" = s."toUserId" where s."artifactId" = ?1 order by s."createdAt"`).bind(l.a.id).all(),
    db.prepare(`select * from "artifactEvent" where "artifactId" = ?1 order by "at" desc limit 40`).bind(l.a.id).all(),
    l.a.workId ? db.prepare(`select "id","title","source","assigneeEmail" from "work" where "id" = ?1`).bind(l.a.workId).first() : null,
    db.prepare(`select "name","email" from "user" where "id" = ?1`).bind(l.a.ownerId).first(),
  ]);
  const t = now();
  const pub = Boolean(l.viaLink);
  return c.json({
    artifact: await artifactJson(c, l.a, l.access, pub),
    owner, work, sections: secs.map((s) => ({ ...s, locked: Boolean(s.lockedUntil && s.lockedUntil > t) })),
    files, shares: shares.results, events: events.results,
    ...(pub ? { owner: owner ? { name: (owner as { name: string }).name } : null, work: null, shares: [], events: [] } : {}),
  });
});

// Plain text for agents: Markdown for docs and decks, CSV for sheets, source for LaTeX/HTML, a file list otherwise.
artifacts.get("/artifacts/:id/text", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const secs = await sections(c.env.DB, l.a.id);
  const section = c.req.query("section");
  if (l.a.kind === "doc" || l.a.kind === "slides") {
    const pick = section ? secs.filter((s, i) => s.id === section || String(i + 1) === section || s.heading.toLowerCase() === section.toLowerCase()) : secs;
    return c.text(joinSections(pick));
  }
  if (l.a.kind === "sheet") {
    return c.text(secs.map((s) => (secs.length > 1 ? `# ${s.heading}\n` : "") + (JSON.parse(s.body || "[]") as unknown[][]).map((r) => r.map(csvCell).join(",")).join("\n")).join("\n\n") + "\n");
  }
  if (l.a.kind === "latex" || l.a.kind === "html") return c.text(secs[0]?.body ?? "");
  const files = await latestFiles(c.env.DB, l.a);
  return c.text(files.map((f: any) => `${f.path}  (${f.contentType}, ${f.size} bytes)`).join("\n") + "\n");
});

artifacts.patch("/artifacts/:id", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = z.object({ title: z.string().min(1).max(200) }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  await c.env.DB.prepare(`update "artifact" set "title" = ?2 where "id" = ?1`).bind(l.a.id, b.data.title).run();
  await event(c, l.a, "renamed", b.data.title, { title: b.data.title });
  return c.json({ ok: true });
});

artifacts.delete("/artifacts/:id", async (c) => {
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  await deleteArtifact(c.env, l.a.id);
  return c.json({ ok: true });
});

// Gone for everyone: rows (cascade) and stored files. Agents reach this only through an approved "artifact.delete".
export async function deleteArtifact(env: Env, id: string) {
  const files = await env.DB.prepare(`select "r2Key" from "artifactFile" where "artifactId" = ?1 union all select "r2Key" from "appFile" where "artifactId" = ?1`).bind(id).all<{ r2Key: string }>();
  for (let i = 0; i < files.results.length; i += 1000) await env.TRAJECTORIES.delete(files.results.slice(i, i + 1000).map((f) => f.r2Key));
  await env.DB.batch([
    env.DB.prepare(`delete from "inboxItem" where "artifactId" = ?1`).bind(id), // an added column: its cascade isn't relied on
    env.DB.prepare(`delete from "artifact" where "id" = ?1`).bind(id),
  ]);
}

// ---------- sections (doc, slides, latex, html) ----------

// Replace everything from Markdown / source (refused while someone else is editing a section).
artifacts.put("/artifacts/:id/content", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = z.object({ content: z.string().max(2_000_000) }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  const me = c.get("user").id;
  const secs = await sections(c.env.DB, l.a.id);
  const busy = secs.find((s) => lockedByOther(s, me));
  if (busy) return c.json({ error: "locked", message: `${busy.lockedName} is editing "${busy.heading || "a section"}" right now.` }, 409);
  const who = actor(c);
  const rows = l.a.kind === "doc" || l.a.kind === "slides"
    ? sectionRows(l.a.id, splitMarkdown(b.data.content), who)
    : sectionRows(l.a.id, [{ heading: secs[0]?.heading ?? "source", body: b.data.content, status: "done" }], who);
  await c.env.DB.batch([c.env.DB.prepare(`delete from "artifactSection" where "artifactId" = ?1`).bind(l.a.id), ...rows.map((r) => insertSection(c.env.DB, r))]);
  await event(c, l.a, "content.replaced", `${rows.length} sections`, { sections: rows });
  return c.json({ sections: rows });
});

const sectionPatch = z.object({
  heading: z.string().max(300).optional(), level: z.number().int().min(1).max(2).optional(), brief: z.string().max(2000).nullable().optional(),
  body: z.string().max(500_000).optional(), status: z.enum(["todo", "writing", "done"]).optional(),
});

artifacts.post("/artifacts/:id/sections", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = sectionPatch.extend({ heading: z.string().max(300), after: z.string().nullable().optional() }).safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", issues: b.error.issues }, 400);
  const secs = await sections(c.env.DB, l.a.id);
  // Position between neighbours: after the given section, else at the end.
  const i = b.data.after === undefined ? secs.length - 1 : secs.findIndex((s) => s.id === b.data.after);
  const before = i >= 0 ? secs[i]!.position : 0;
  const next = secs[i + 1]?.position ?? before + 2;
  const [row] = sectionRows(l.a.id, [{ heading: b.data.heading, level: b.data.level, brief: b.data.brief, body: b.data.body, status: b.data.status }], actor(c));
  row!.position = (before + next) / 2;
  await insertSection(c.env.DB, row!).run();
  await event(c, l.a, "section.added", row!.heading, { section: row });
  return c.json({ section: row }, 201);
});

artifacts.put("/artifacts/:id/sections/:sid", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = sectionPatch.safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", issues: b.error.issues }, 400);
  const db = c.env.DB;
  const s = await db.prepare(`select * from "artifactSection" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("sid"), l.a.id).first<SectionRow>();
  if (!s) return c.json({ error: "not_found" }, 404);
  const who = actor(c);
  if (lockedByOther(s, who.id)) return c.json({ error: "locked", message: `${s.lockedName} is editing "${s.heading || "this section"}" right now — try another section.` }, 409);
  const next = {
    heading: b.data.heading ?? s.heading, level: b.data.level ?? s.level, brief: b.data.brief === undefined ? s.brief : b.data.brief,
    body: b.data.body ?? s.body, status: b.data.status ?? (b.data.body !== undefined ? "done" : s.status),
  };
  const ts = now();
  await db.prepare(`update "artifactSection" set "heading" = ?2, "level" = ?3, "brief" = ?4, "body" = ?5, "status" = ?6, "updatedBy" = ?7, "updatedName" = ?8, "updatedAt" = ?9 where "id" = ?1`)
    .bind(s.id, next.heading, next.level, next.brief, next.body, next.status, who.id, who.name, ts).run();
  const section = { ...s, ...next, updatedBy: who.id, updatedName: who.name, updatedAt: ts };
  await event(c, l.a, "section.updated", next.heading || null, { section });
  return c.json({ section });
});

artifacts.delete("/artifacts/:id/sections/:sid", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const s = await c.env.DB.prepare(`select * from "artifactSection" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("sid"), l.a.id).first<SectionRow>();
  if (!s) return c.json({ error: "not_found" }, 404);
  if (lockedByOther(s, c.get("user").id)) return c.json({ error: "locked", message: `${s.lockedName} is editing it.` }, 409);
  await c.env.DB.prepare(`delete from "artifactSection" where "id" = ?1`).bind(s.id).run();
  await event(c, l.a, "section.deleted", s.heading || null, { sectionId: s.id });
  return c.json({ ok: true });
});

// Claim a section while editing it (renewed every ~30 s by the editor); others see who is there.
artifacts.post("/artifacts/:id/sections/:sid/lock", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const on = (await c.req.json().catch(() => ({})) as { on?: boolean }).on !== false;
  const who = actor(c);
  const db = c.env.DB;
  const s = await db.prepare(`select * from "artifactSection" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("sid"), l.a.id).first<SectionRow>();
  if (!s) return c.json({ error: "not_found" }, 404);
  if (lockedByOther(s, who.id)) return c.json({ error: "locked", message: `${s.lockedName} is editing this section.` }, 409);
  const until = on ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  await db.prepare(`update "artifactSection" set "lockedBy" = ?2, "lockedName" = ?3, "lockedUntil" = ?4 where "id" = ?1`)
    .bind(s.id, on ? who.id : null, on ? who.name : null, until).run();
  c.executionCtx.waitUntil(roomBroadcast(c.env, l.a.id, { type: "section.lock", sectionId: s.id, by: on ? who : null, until }).catch(() => {}));
  return c.json({ ok: true, until });
});

// ---------- sheets ----------

// Set cells; concurrent editors don't clobber each other (optimistic retry on the row's updatedAt).
artifacts.post("/artifacts/:id/sheet/:sid/cells", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = z.object({ cells: z.array(z.object({ r: z.number().int().min(0).max(100_000), c: z.number().int().min(0).max(1000), v: z.union([z.string(), z.number(), z.null()]) })).max(5000) })
    .safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", issues: b.error.issues }, 400);
  const db = c.env.DB;
  const who = actor(c);
  for (let attempt = 0; attempt < 5; attempt++) {
    const s = await db.prepare(`select * from "artifactSection" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("sid"), l.a.id).first<SectionRow>();
    if (!s) return c.json({ error: "not_found" }, 404);
    const rows = JSON.parse(s.body || "[]") as unknown[][];
    for (const { r, c: col, v } of b.data.cells) {
      while (rows.length <= r) rows.push([]);
      const row = rows[r]!;
      while (row.length <= col) row.push("");
      row[col] = v ?? "";
    }
    const ts = now();
    const res = await db.prepare(`update "artifactSection" set "body" = ?2, "updatedBy" = ?3, "updatedName" = ?4, "updatedAt" = ?5 where "id" = ?1 and "updatedAt" = ?6`)
      .bind(s.id, JSON.stringify(rows), who.id, who.name, ts, s.updatedAt).run();
    if (res.meta.changes) {
      await event(c, l.a, "cells.updated", `${b.data.cells.length} cell(s) in ${s.heading}`, { sectionId: s.id, cells: b.data.cells });
      return c.json({ ok: true });
    }
  }
  return c.json({ error: "busy", message: "Too many edits at once; try again." }, 409);
});

// Replace a whole tab (import, paste, agent rewrite), or add one.
artifacts.put("/artifacts/:id/sheet/:sid", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = z.object({ rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(100_000), name: z.string().max(100).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body" }, 400);
  const who = actor(c);
  const ts = now();
  const sid = c.req.param("sid");
  const db = c.env.DB;
  const exists = await db.prepare(`select "id","heading" from "artifactSection" where "id" = ?1 and "artifactId" = ?2`).bind(sid, l.a.id).first<{ heading: string }>();
  if (exists) {
    await db.prepare(`update "artifactSection" set "body" = ?2, "heading" = ?3, "status" = 'done', "updatedBy" = ?4, "updatedName" = ?5, "updatedAt" = ?6 where "id" = ?1`)
      .bind(sid, JSON.stringify(b.data.rows), b.data.name ?? exists.heading, who.id, who.name, ts).run();
  } else {
    const n = (await sections(db, l.a.id)).length;
    const [row] = sectionRows(l.a.id, [{ heading: b.data.name ?? `Sheet${n + 1}`, body: JSON.stringify(b.data.rows), status: "done" }], who, n);
    row!.id = sid === "new" ? row!.id : sid;
    await insertSection(db, row!).run();
  }
  await event(c, l.a, "sheet.replaced", b.data.name ?? exists?.heading ?? null, { sectionId: sid });
  return c.json({ ok: true });
});

// ---------- files (Office/PDF originals, compiled PDFs, small apps) ----------

const MAX_FILE = 25 * 1024 * 1024;
const safePath = (p: string) => p.replace(/\\/g, "/").split("/").filter((x) => x && x !== "." && x !== "..").join("/");

// Start a new version; files are then PUT into it. A single-file upload can pass ?path= to do both at once.
artifacts.post("/artifacts/:id/versions", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const v = l.a.version + ((await c.env.DB.prepare(`select 1 from "artifactFile" where "artifactId" = ?1 and "version" = ?2 limit 1`).bind(l.a.id, l.a.version).first()) ? 1 : 0);
  await c.env.DB.prepare(`update "artifact" set "version" = ?2 where "id" = ?1`).bind(l.a.id, v).run();
  return c.json({ version: v });
});

artifacts.put("/artifacts/:id/versions/:v/files/*", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const v = Number(c.req.param("v"));
  if (v !== l.a.version) return c.json({ error: "stale_version", version: l.a.version }, 409);
  const path = safePath(decodeURIComponent(c.req.path.split(`/versions/${v}/files/`)[1] ?? ""));
  if (!path) return c.json({ error: "bad_path" }, 400);
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength > MAX_FILE) return c.json({ error: "too_large", message: "Files are limited to 25 MB." }, 413);
  const contentType = c.req.header("content-type") || "application/octet-stream";
  const key = `artifacts/${l.a.id}/v${v}/${path}`;
  await c.env.TRAJECTORIES.put(key, bytes, { httpMetadata: { contentType } });
  const who = actor(c);
  await c.env.DB.prepare(`insert into "artifactFile" ("id","artifactId","version","path","r2Key","contentType","size","createdBy","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8,?9)`)
    .bind(newId(), l.a.id, v, path, key, contentType, bytes.byteLength, who.name, now()).run();
  return c.json({ ok: true, path, size: bytes.byteLength });
});

// Mark an upload complete (one event for the whole version).
artifacts.post("/artifacts/:id/versions/:v/done", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const files = await latestFiles(c.env.DB, l.a);
  await event(c, l.a, "version.uploaded", `version ${l.a.version} · ${files.length} file(s)`, { version: l.a.version });
  return c.json({ version: l.a.version, files });
});

artifacts.get("/artifacts/:id/files/*", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const path = safePath(decodeURIComponent(c.req.path.split("/files/")[1] ?? ""));
  const v = Number(c.req.query("v") ?? l.a.version);
  const f = await c.env.DB.prepare(`select * from "artifactFile" where "artifactId" = ?1 and "version" = ?2 and "path" = ?3`).bind(l.a.id, v, path).first<{ r2Key: string; contentType: string }>();
  if (!f) return c.json({ error: "not_found" }, 404);
  const obj = await c.env.TRAJECTORIES.get(f.r2Key);
  if (!obj) return c.json({ error: "not_found" }, 404);
  // Served on the app's own origin, so never as a document that could run script here.
  return new Response(obj.body, {
    headers: {
      "Content-Type": /html|svg|xml|javascript/.test(f.contentType) ? "application/octet-stream" : f.contentType,
      "Content-Disposition": `${c.req.query("download") ? "attachment" : "inline"}; filename="${path.split("/").pop()!.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=60",
    },
  });
});

artifacts.get("/artifacts/:id/versions", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const { results } = await c.env.DB.prepare(`select "version", count(*) as "files", sum("size") as "size", min("createdAt") as "createdAt", max("createdBy") as "by" from "artifactFile" where "artifactId" = ?1 group by "version" order by "version" desc`)
    .bind(l.a.id).all();
  return c.json({ versions: results });
});

// ---------- share / handover ----------

const shareBody = z.object({ to: z.string().min(1).max(200), role: z.enum(["viewer", "editor"]).default("editor"), note: z.string().max(2000).optional() });

async function shareTo(c: Context<AppEnv>, a: ArtifactRow, to: string, role: "viewer" | "editor", kind: "artifact.share" | "artifact.handover", note: string | null) {
  const db = c.env.DB;
  const me = c.get("user");
  const email = normEmail(to);
  const recipient = await db.prepare(`select "id" from "user" where lower("email") = ?1`).bind(email).first<{ id: string }>();
  const ts = now();
  const inboxId = newId();
  await db.batch([
    db.prepare(`insert into "artifactShare" ("id","artifactId","toUserId","toEmail","role","createdBy","createdAt") values (?1,?2,?3,?4,?5,?6,?7)
                on conflict ("artifactId","toEmail") do update set "role" = excluded."role"`).bind(newId(), a.id, recipient?.id ?? null, email, role, me.id, ts),
    db.prepare(`insert into "inboxItem" ("id","userId","toEmail","kind","workId","artifactId","fromUserId","body","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8,?9)`)
      .bind(inboxId, recipient?.id ?? null, email, kind, a.workId, a.id, me.id, note, ts),
  ]);
  if (recipient) {
    const item = { id: inboxId, kind, artifactId: a.id, artifactTitle: a.title, workId: a.workId, fromName: me.name || me.email, body: note, createdAt: ts };
    c.executionCtx.waitUntil(publish(c.env, [recipient.id], { type: "inbox.new", item }).catch(() => {}));
  }
  return { toUserId: recipient?.id ?? null, toEmail: email };
}

artifacts.post("/artifacts/:id/share", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  const b = shareBody.safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", issues: b.error.issues }, 400);
  const who = await resolveTeammate(c.env.DB, c.get("user").id, b.data.to);
  if ("error" in who) return c.json(who, 400);
  if (normEmail(who.email) === normEmail(c.get("user").email)) return c.json({ error: "cannot_share_with_self" }, 400);
  const r = await shareTo(c, l.a, who.email, b.data.role, "artifact.share", b.data.note ?? null);
  await event(c, l.a, "shared", `${r.toEmail} (${b.data.role})`);
  return c.json({ share: { ...r, role: b.data.role } }, 201);
});

// Hand it over: the recipient becomes the owner (and can edit, share, hand on); the previous owner keeps edit access.
artifacts.post("/artifacts/:id/handover", async (c) => {
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  const b = shareBody.safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid_body", issues: b.error.issues }, 400);
  const me = c.get("user");
  const who = await resolveTeammate(c.env.DB, me.id, b.data.to);
  if ("error" in who) return c.json(who, 400);
  if (normEmail(who.email) === normEmail(me.email)) return c.json({ error: "cannot_share_with_self" }, 400);
  const r = await shareTo(c, l.a, who.email, "editor", "artifact.handover", b.data.note ?? null);
  if (r.toUserId) {
    await c.env.DB.batch([
      c.env.DB.prepare(`update "artifact" set "ownerId" = ?2 where "id" = ?1`).bind(l.a.id, r.toUserId),
      c.env.DB.prepare(`insert into "artifactShare" ("id","artifactId","toUserId","toEmail","role","createdBy","createdAt") values (?1,?2,?3,?4,'editor',?5,?6)
                        on conflict ("artifactId","toEmail") do update set "role" = 'editor'`).bind(newId(), l.a.id, me.id, normEmail(me.email), me.id, now()),
      c.env.DB.prepare(`delete from "artifactShare" where "artifactId" = ?1 and "toUserId" = ?2`).bind(l.a.id, r.toUserId),
    ]);
  }
  await event(c, l.a, "handed_over", r.toEmail);
  return c.json({ handover: r }, 201);
});

artifacts.delete("/artifacts/:id/shares/:shareId", async (c) => {
  const l = await load(c, "owner");
  if (l instanceof Response) return l;
  await c.env.DB.prepare(`delete from "artifactShare" where "id" = ?1 and "artifactId" = ?2`).bind(c.req.param("shareId"), l.a.id).run();
  await event(c, l.a, "share.revoked", null);
  return c.json({ ok: true });
});

// ---------- app permissions (granted via the "app.grant" action; see apps.ts) ----------

artifacts.get("/artifacts/:id/grants", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const { liveGrants } = await import("./apps.ts");
  const { ACTIONS } = await import("./delegate.ts");
  const live = new Set((await liveGrants(c.env.DB, l.a.id)).map((g) => g.id));
  const { results } = await c.env.DB.prepare(
    `select g.*, u."name" as "userName", u."email" as "userEmail", (g."grantorSessionId" is not null) as "viaAgent"
     from "appGrant" g join "user" u on u."id" = g."userId" where g."artifactId" = ?1 order by g."createdAt" desc limit 100`,
  ).bind(l.a.id).all<{ id: string; action: keyof typeof ACTIONS; scope: string | null; expiresAt: string; revokedAt: string | null; createdAt: string; userName: string; userEmail: string; viaAgent: number }>();
  return c.json({
    grants: results.map((g) => ({
      id: g.id, action: g.action, label: ACTIONS[g.action]?.label ?? g.action, scope: g.scope ? JSON.parse(g.scope) : null, expiresAt: g.expiresAt, createdAt: g.createdAt,
      by: g.userName || g.userEmail, viaAgent: Boolean(g.viaAgent), status: g.revokedAt ? "revoked" : live.has(g.id) ? "active" : "expired",
    })),
  });
});

// Taking a permission back is always allowed (it only narrows), by anyone who can edit the app.
artifacts.delete("/artifacts/:id/grants/:gid", async (c) => {
  const l = await load(c, "edit");
  if (l instanceof Response) return l;
  await c.env.DB.prepare(`update "appGrant" set "revokedAt" = ?3 where "id" = ?1 and "artifactId" = ?2 and "revokedAt" is null`).bind(c.req.param("gid"), l.a.id, now()).run();
  await event(c, l.a, "grant.revoked", null);
  return c.json({ ok: true });
});

// ---------- live room ----------

artifacts.get("/artifacts/:id/live", async (c) => {
  const l = await load(c, "view");
  if (l instanceof Response) return l;
  const who = actor(c);
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-user-id", who.id);
  headers.set("x-user-name", who.name);
  headers.set("x-via", who.via);
  return c.env.ROOM.get(c.env.ROOM.idFromName(l.a.id)).fetch(new Request("https://room/connect", { headers }));
});

// ---------- runtime for HTML and small apps ----------
// /u/<id>/<capability>/<path>, served on the separate content origin; the capability is an HMAC only people with
// access are given. In production the main host refuses these paths, so app code never runs on anydock.ai.
export const usercontent = new Hono<AppEnv>();
usercontent.get("/u/:id/:sig", (c) => c.redirect(c.req.path + "/"));
usercontent.get("/u/:id/:sig/*", async (c) => {
  const content = c.env.USERCONTENT_ORIGIN;
  if (content?.startsWith("https://") && new URL(c.req.url).host !== new URL(content).host) return c.text("Not found", 404);
  const id = c.req.param("id");
  const cap = await appCapability(c.env, id, c.req.param("sig"));
  if (!cap) return c.text("Not found", 404);
  const a = await c.env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(id).first<ArtifactRow>();
  if (!a || (cap === "ro" && !a.publicToken)) return c.text("Not found", 404); // the read-only link dies with the public link
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (a.kind === "html") {
    const s = await c.env.DB.prepare(`select "body" from "artifactSection" where "artifactId" = ?1 order by "position" limit 1`).bind(id).first<{ body: string }>();
    return new Response(s?.body ?? "", { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  }
  let path = safePath(decodeURIComponent(c.req.path.split(`/${c.req.param("sig")}/`)[1] ?? ""));
  const find = (p: string) => c.env.DB.prepare(`select "r2Key","contentType" from "artifactFile" where "artifactId" = ?1 and "version" = ?2 and "path" = ?3`).bind(id, a.version, p).first<{ r2Key: string; contentType: string }>();
  let f = path ? await find(path) : null;
  if (!f) f = await find(path ? `${path}/index.html` : "index.html");
  if (!f && !path) {
    // No index.html: serve the first HTML file.
    path = (await c.env.DB.prepare(`select "path" from "artifactFile" where "artifactId" = ?1 and "version" = ?2 and "path" like '%.html' order by length("path") limit 1`).bind(id, a.version).first<{ path: string }>())?.path ?? "";
    f = path ? await find(path) : null;
  }
  if (!f) return c.text("Not found", 404);
  // Text without a declared charset is UTF-8 (agents write UTF-8; browsers would otherwise guess Latin-1).
  const type = /^(text\/|application\/(javascript|json))/.test(f.contentType) && !/charset/i.test(f.contentType) ? `${f.contentType}; charset=utf-8` : f.contentType;
  // Byte ranges, so apps can seek in their own video and audio.
  const m = /^bytes=(\d*)-(\d*)$/.exec(c.req.header("range") ?? "");
  if (m) {
    const head = await c.env.TRAJECTORIES.head(f.r2Key);
    if (!head) return c.text("Not found", 404);
    const size = head.size, start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    const part = await c.env.TRAJECTORIES.get(f.r2Key, { range: { offset: start, length: end - start + 1 } });
    if (!part) return c.text("Not found", 404);
    return new Response(part.body, { status: 206, headers: { ...headers, "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const obj = await c.env.TRAJECTORIES.get(f.r2Key);
  if (!obj) return c.text("Not found", 404);
  return new Response(obj.body, { headers: { ...headers, "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(obj.size) } });
});
