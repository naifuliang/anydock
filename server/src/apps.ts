import { Hono, type Context } from "hono";
import { appCapability, appSig, type ArtifactRow } from "./artifacts.ts";
import { ACTIONS, actionJson, classify, requestAction, type ActionRow, type Grantable } from "./delegate.ts";
import { sandboxRuntime } from "./sandbox.ts";
import { hmacHex } from "./secure.ts";
import type { AppEnv, Env, User } from "./types.ts";

// The backend every app (artifact kind app/html) gets, on its own origin under /u/<id>/<capability>/:
//   _anydock.js                 the client SDK (window.anydock)
//   _api/data/<collection>[/key]  a shared data store (JSON values, ≤1 MB each, 50,000 per app)
//   _api/files[/<name>]         file storage for recordings, photos, attachments (R2; ≤100 MB each, 2 GB per app)
//   _api/info                   what this link may do: edit, view (public link) or submit (public link, submissions on)
//   _api/call                   act through AnyDock — only what the app was granted (person → agent → app, narrowing)
//   _backend/*                  the app's own server code, running in a sandbox (sandbox.ts), behind the same rules
// No cookies, no tokens: the capability URL identifies the app, and every call is checked against its grants.
// Two capabilities: rw (people with access) and ro (public-link visitors): ro reads; while the owner accepts submissions
// it may also add new values and files, but never overwrite or delete, act through grants, or reach the backend.
export const apps = new Hono<AppEnv>();

const now = () => new Date().toISOString();
const MAX_VALUE = 1024 * 1024;
const MAX_ROWS = 50_000;
const MAX_FILE = 100 * 1024 * 1024;
const MAX_APP_BYTES = 2 * 1024 * 1024 * 1024;

type Grant = { id: string; artifactId: string; userId: string; grantorSessionId: string | null; action: Grantable; scope: string | null; expiresAt: string; createdAt: string };

type Mode = "edit" | "view" | "submit";
type App = ArtifactRow & { mode: Mode };

// need: "read" (anyone with the URL), "add" (rw, or ro while submissions are on), "edit" (rw only).
async function app(c: Context<AppEnv>, need: "read" | "add" | "edit" = "edit"): Promise<App | Response> {
  const content = c.env.USERCONTENT_ORIGIN;
  if (content?.startsWith("https://") && new URL(c.req.url).host !== new URL(content).host) return c.json({ error: "not_found" }, 404);
  const id = c.req.param("id")!;
  const cap = await appCapability(c.env, id, c.req.param("sig")!);
  if (!cap) return c.json({ error: "not_found" }, 404);
  const a = await c.env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(id).first<ArtifactRow>();
  if (!a || (a.kind !== "app" && a.kind !== "html")) return c.json({ error: "not_found" }, 404);
  if (cap === "ro" && !a.publicToken) return c.json({ error: "not_found" }, 404); // dies with the public link
  const mode: Mode = cap === "rw" ? "edit" : a.publicSubmit ? "submit" : "view";
  if (need === "edit" && mode !== "edit") return c.json({ error: "read_only", message: "This is a public view of the app: it can't change or delete anything here." }, 403);
  if (need === "add" && mode === "view") return c.json({ error: "read_only", message: "This is a public view of the app; its owner hasn't turned on submissions." }, 403);
  return { ...a, mode };
}
const base = (c: Context<AppEnv>) => `/u/${c.req.param("id")}/${c.req.param("sig")}/`;

// A grant is live only while the whole chain holds: not expired or revoked, and the agent login that asked for it
// still exists. (The person's current rule is checked when the action runs.)
export async function liveGrants(db: D1Database, artifactId: string): Promise<Grant[]> {
  const { results } = await db
    .prepare(
      `select g.* from "appGrant" g left join "session" s on s."id" = g."grantorSessionId"
       where g."artifactId" = ?1 and g."revokedAt" is null and g."expiresAt" > ?2
         and (g."grantorSessionId" is null or (s."id" is not null and s."expiresAt" > ?2))
       order by g."createdAt" desc`,
    )
    .bind(artifactId, now())
    .all<Grant>();
  return results;
}

// ---------- SDK ----------

apps.get("/u/:id/:sig/_anydock.js", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  return new Response(SDK, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
});

apps.get("/u/:id/:sig/_api/info", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  return c.json({ mode: a.mode, title: a.title });
});

// ---------- data ----------

const okName = (s: string) => s.length > 0 && s.length <= 100;

apps.get("/u/:id/:sig/_api/data/:collection", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  const { results } = await c.env.DB.prepare(`select "key","value","updatedAt" from "appData" where "artifactId" = ?1 and "collection" = ?2 order by "updatedAt" desc limit 1000`)
    .bind(a.id, c.req.param("collection")).all<{ key: string; value: string; updatedAt: string }>();
  return c.json({ items: results.map((r) => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updatedAt })) });
});

apps.get("/u/:id/:sig/_api/data/:collection/:key", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  const r = await c.env.DB.prepare(`select "value","updatedAt" from "appData" where "artifactId" = ?1 and "collection" = ?2 and "key" = ?3`)
    .bind(a.id, c.req.param("collection"), c.req.param("key")).first<{ value: string; updatedAt: string }>();
  return r ? c.json({ value: JSON.parse(r.value), updatedAt: r.updatedAt }) : c.json({ error: "not_found" }, 404);
});

apps.put("/u/:id/:sig/_api/data/:collection/:key", async (c) => {
  const a = await app(c, "add");
  if (a instanceof Response) return a;
  const collection = c.req.param("collection"), key = c.req.param("key");
  if (!okName(collection) || !okName(key)) return c.json({ error: "bad_name", message: "Collection and key: 1–100 characters." }, 400);
  const body = (await c.req.json().catch(() => null)) as { value?: unknown } | null;
  if (!body || !("value" in body)) return c.json({ error: "invalid_body", message: 'Send {"value": …}' }, 400);
  const value = JSON.stringify(body.value);
  if (new TextEncoder().encode(value).length > MAX_VALUE) return c.json({ error: "too_large", message: "Values are limited to 1 MB — keep recordings and other big things in anydock.files." }, 413);
  const count = await c.env.DB.prepare(`select count(*) as n from "appData" where "artifactId" = ?1`).bind(a.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ROWS) return c.json({ error: "full", message: `This app's data store is full (${MAX_ROWS} values).` }, 413);
  const ts = now();
  if (a.mode === "submit") { // a public submission only adds: it never overwrites someone's entry
    const r = await c.env.DB.prepare(`insert into "appData" ("artifactId","collection","key","value","updatedAt") values (?1,?2,?3,?4,?5) on conflict do nothing`)
      .bind(a.id, collection, key, value, ts).run();
    if (!r.meta.changes) return c.json({ error: "exists", message: "That key is taken — public submissions can only add new entries (use a fresh key, e.g. crypto.randomUUID())." }, 409);
    return c.json({ ok: true, updatedAt: ts });
  }
  await c.env.DB.prepare(`insert into "appData" ("artifactId","collection","key","value","updatedAt") values (?1,?2,?3,?4,?5)
    on conflict ("artifactId","collection","key") do update set "value" = excluded."value", "updatedAt" = excluded."updatedAt"`)
    .bind(a.id, collection, key, value, ts).run();
  return c.json({ ok: true, updatedAt: ts });
});

apps.delete("/u/:id/:sig/_api/data/:collection/:key", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  await c.env.DB.prepare(`delete from "appData" where "artifactId" = ?1 and "collection" = ?2 and "key" = ?3`).bind(a.id, c.req.param("collection"), c.req.param("key")).run();
  return c.json({ ok: true });
});

// ---------- files ----------
// Bytes in R2 under apps/<artifactId>/files/; served back with byte ranges (seekable audio/video), and never as a
// document that could run script on the app's origin (a submitted .html stays inert).

type AppFile = { name: string; size: number; contentType: string; r2Key: string; createdAt: string; updatedAt: string };
const fileName = (c: Context<AppEnv>) => { try { return decodeURIComponent(c.req.path.split("/_api/files/")[1] ?? ""); } catch { return ""; } };
const okFile = (n: string) => n.length > 0 && n.length <= 300 && !n.split("/").some((p) => p === "" || p === "." || p === "..");
const fileJson = (c: Context<AppEnv>, f: AppFile) => ({ name: f.name, size: f.size, contentType: f.contentType, updatedAt: f.updatedAt, url: `${base(c)}_api/files/${f.name.split("/").map(encodeURIComponent).join("/")}` });

apps.get("/u/:id/:sig/_api/files", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  const prefix = c.req.query("prefix") ?? "";
  const { results } = await c.env.DB.prepare(`select * from "appFile" where "artifactId" = ?1 and substr("name", 1, length(?2)) = ?2 order by "updatedAt" desc limit 1000`).bind(a.id, prefix).all<AppFile>();
  const used = await c.env.DB.prepare(`select coalesce(sum("size"), 0) as n from "appFile" where "artifactId" = ?1`).bind(a.id).first<{ n: number }>();
  return c.json({ files: results.map((f) => fileJson(c, f)), used: used?.n ?? 0, limit: MAX_APP_BYTES });
});

apps.get("/u/:id/:sig/_api/files/*", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  const f = await c.env.DB.prepare(`select * from "appFile" where "artifactId" = ?1 and "name" = ?2`).bind(a.id, fileName(c)).first<AppFile>();
  if (!f) return c.json({ error: "not_found" }, 404);
  const headers: Record<string, string> = {
    "Content-Type": /html|svg|xml|javascript/i.test(f.contentType) ? "application/octet-stream" : f.contentType,
    "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Accept-Ranges": "bytes",
  };
  if (c.req.query("download") !== undefined) headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(f.name.split("/").pop()!)}`;
  const m = /^bytes=(\d*)-(\d*)$/.exec(c.req.header("range") ?? "");
  if (m && (m[1] || m[2])) {
    const size = f.size, start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    const part = await c.env.TRAJECTORIES.get(f.r2Key, { range: { offset: start, length: end - start + 1 } });
    if (!part) return c.json({ error: "not_found" }, 404);
    return new Response(part.body, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  const obj = await c.env.TRAJECTORIES.get(f.r2Key);
  if (!obj) return c.json({ error: "not_found" }, 404);
  return new Response(obj.body, { headers: { ...headers, "Content-Length": String(obj.size) } });
});

// PUT the raw bytes (Content-Type = the file's type). Replaces a file of the same name (people with access only).
apps.put("/u/:id/:sig/_api/files/*", async (c) => {
  const a = await app(c, "add");
  if (a instanceof Response) return a;
  const name = fileName(c);
  if (!okFile(name)) return c.json({ error: "bad_name", message: "File names: 1–300 characters, folders with /, no empty, . or .. parts." }, 400);
  const size = Number(c.req.header("content-length"));
  if (!Number.isFinite(size) || size < 0 || !c.req.raw.body && size > 0) return c.json({ error: "length_required", message: "Send the bytes with a Content-Length." }, 411);
  if (size > MAX_FILE) return c.json({ error: "too_large", message: "Files are limited to 100 MB each." }, 413);
  const db = c.env.DB;
  const old = await db.prepare(`select * from "appFile" where "artifactId" = ?1 and "name" = ?2`).bind(a.id, name).first<AppFile>();
  if (old && a.mode !== "edit") return c.json({ error: "exists", message: "That name is taken — public submissions can only add new files." }, 409);
  const used = await db.prepare(`select coalesce(sum("size"), 0) as n from "appFile" where "artifactId" = ?1`).bind(a.id).first<{ n: number }>();
  if ((used?.n ?? 0) - (old?.size ?? 0) + size > MAX_APP_BYTES) return c.json({ error: "full", message: "This app's file storage is full (2 GB)." }, 413);
  const contentType = (c.req.header("content-type") || "application/octet-stream").slice(0, 200);
  const r2Key = `apps/${a.id}/files/${crypto.randomUUID()}`;
  let body: ReadableStream | ArrayBuffer = new ArrayBuffer(0);
  if (c.req.raw.body && size > 0) { const { readable, writable } = new FixedLengthStream(size); c.req.raw.body.pipeTo(writable).catch(() => {}); body = readable; }
  try { await c.env.TRAJECTORIES.put(r2Key, body, { httpMetadata: { contentType } }); }
  catch { return c.json({ error: "upload_failed", message: "The upload didn't arrive in full." }, 400); }
  const ts = now();
  const write = a.mode === "edit"
    ? db.prepare(`insert into "appFile" ("artifactId","name","size","contentType","r2Key","createdAt","updatedAt") values (?1,?2,?3,?4,?5,?6,?6)
        on conflict ("artifactId","name") do update set "size" = excluded."size", "contentType" = excluded."contentType", "r2Key" = excluded."r2Key", "updatedAt" = excluded."updatedAt"`)
    : db.prepare(`insert into "appFile" ("artifactId","name","size","contentType","r2Key","createdAt","updatedAt") values (?1,?2,?3,?4,?5,?6,?6) on conflict do nothing`);
  const r = await write.bind(a.id, name, size, contentType, r2Key, ts).run();
  if (!r.meta.changes) { await c.env.TRAJECTORIES.delete(r2Key); return c.json({ error: "exists", message: "That name is taken — public submissions can only add new files." }, 409); }
  if (old) c.executionCtx.waitUntil(c.env.TRAJECTORIES.delete(old.r2Key));
  return c.json({ file: fileJson(c, { name, size, contentType, r2Key, createdAt: old?.createdAt ?? ts, updatedAt: ts }) }, old ? 200 : 201);
});

apps.delete("/u/:id/:sig/_api/files/*", async (c) => {
  const a = await app(c, "edit");
  if (a instanceof Response) return a;
  const f = await c.env.DB.prepare(`delete from "appFile" where "artifactId" = ?1 and "name" = ?2 returning "r2Key"`).bind(a.id, fileName(c)).first<{ r2Key: string }>();
  if (f) await c.env.TRAJECTORIES.delete(f.r2Key);
  return c.json({ ok: true });
});

// ---------- grants + calls ----------

apps.get("/u/:id/:sig/_api/grants", async (c) => {
  const a = await app(c, "read");
  if (a instanceof Response) return a;
  const grants = await liveGrants(c.env.DB, a.id);
  return c.json({ grants: grants.map((g) => ({ action: g.action, label: ACTIONS[g.action].label, scope: g.scope ? JSON.parse(g.scope) : null, expiresAt: g.expiresAt })) });
});

apps.post("/u/:id/:sig/_api/call", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const body = (await c.req.json().catch(() => null)) as { action?: string; payload?: unknown } | null;
  if (!body?.action) return c.json({ error: "invalid_body", message: 'Send {"action": "slack.post" | "email" | "text", "payload": {…}}' }, 400);
  const grants = await liveGrants(c.env.DB, a.id);
  let refusal = `“${a.title}” hasn't been given permission for this. Its owner's agent can ask for it (anydock_app_grant), and the owner approves.`;
  for (const g of grants) {
    const user = await c.env.DB.prepare(`select * from "user" where "id" = ?1`).bind(g.userId).first<User>();
    if (!user) continue;
    const cl = await classify(c.env, user, body.action, body.payload ?? {}, null);
    if ("error" in cl) return c.json(cl, 400);
    if (cl.action !== g.action) continue;
    const scope = g.scope ? (JSON.parse(g.scope) as { to?: string[] }) : null;
    if (scope?.to?.length && !scope.to.some((t) => t.toLowerCase() === String(cl.payload.to ?? "").toLowerCase())) {
      refusal = `“${a.title}” may only ${ACTIONS[g.action].label.toLowerCase()} to ${scope.to.join(", ")}.`;
      continue;
    }
    // The person's rule still applies on top of the grant: allow → now, ask → they approve, deny → blocked.
    const { row, code } = await requestAction(c.env, new URL(c.env.BETTER_AUTH_URL).origin, user,
      { action: cl.action, payload: { ...cl.payload, _app: a.id, _grant: g.id }, summary: `${cl.summary} — by app “${a.title}”`, agent: `app: ${a.title}` }, (p) => c.executionCtx.waitUntil(p));
    return c.json({ action: appAction(row) }, code);
  }
  return c.json({ error: "not_granted", message: refusal }, 403);
});

apps.get("/u/:id/:sig/_api/call/:rid", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const row = await c.env.DB.prepare(`select * from "actionRequest" where "id" = ?1`).bind(c.req.param("rid")).first<ActionRow>();
  if (!row || JSON.parse(row.payload)._app !== a.id) return c.json({ error: "not_found" }, 404);
  return c.json({ action: appAction(row) });
});

// What an app may see about its own requests (no user ids).
const appAction = (r: ActionRow) => {
  const j = actionJson(r) as Record<string, any>;
  return { id: j.id, status: j.status, summary: j.summary, decidedVia: j.decidedVia, result: j.result ? { detail: j.result.detail } : null };
};

// ---------- the app's own backend, in a sandbox ----------

apps.all("/u/:id/:sig/_backend/*", async (c) => {
  // The backend holds the full capability, so a public link reaches it only while the owner accepts submissions.
  const a = await app(c, "add");
  if (a instanceof Response) return a;
  const files = await c.env.DB.prepare(`select "path","r2Key" from "artifactFile" where "artifactId" = ?1 and "version" = ?2`).bind(a.id, a.version).all<{ path: string; r2Key: string }>();
  const entry = files.results.find((f) => f.path === "server.js" || f.path === "server/index.js" || f.path === "package.json");
  if (!entry) return c.json({ error: "no_backend", message: "This app has no backend (add server.js that listens on $PORT)." }, 404);
  const runtime = sandboxRuntime(c.env);
  if (!runtime) return c.json({ error: "runtime_not_configured", message: "App backends run in a sandbox (Blaxel or Cloudflare Containers), and neither is configured on this server." }, 503);
  const url = await ensureBackend(c.env, runtime, a, files.results, `${c.env.USERCONTENT_ORIGIN ?? new URL(c.req.url).origin}/u/${a.id}/${await appSig(c.env, a.id)}/`);
  const rest = c.req.path.split("/_backend/")[1] ?? "";
  const headers = new Headers(c.req.raw.headers);
  ["cookie", "authorization", "host"].forEach((h) => headers.delete(h));
  return runtime.request(c.env, `${url.replace(/\/$/, "")}/${rest}${new URL(c.req.url).search}`, { method: c.req.method, headers, body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.arrayBuffer() });
});

// The app's files for a sandbox that fetches them itself (Cloudflare Containers): signed per app + version.
const bundleSig = (env: Env, id: string, v: number) => hmacHex(env.BETTER_AUTH_SECRET, `artifact-bundle:${id}:${v}`).then((h) => h.slice(0, 32));
apps.get("/u/:id/:sig/_bundle/:v/:bsig", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const v = Number(c.req.param("v"));
  if (c.req.param("bsig") !== (await bundleSig(c.env, a.id, v))) return c.json({ error: "not_found" }, 404);
  const { results } = await c.env.DB.prepare(`select "path","r2Key" from "artifactFile" where "artifactId" = ?1 and "version" = ?2`).bind(a.id, v).all<{ path: string; r2Key: string }>();
  const files = await Promise.all(results.map(async (f) => {
    const bytes = new Uint8Array(await (await c.env.TRAJECTORIES.get(f.r2Key))!.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { path: f.path, data: btoa(bin) };
  }));
  return c.json({ files }, 200, { "Cache-Control": "no-store" });
});

async function ensureBackend(env: Env, runtime: NonNullable<ReturnType<typeof sandboxRuntime>>, a: ArtifactRow, files: { path: string; r2Key: string }[], appBase: string): Promise<string> {
  const row = await env.DB.prepare(`select * from "appRuntime" where "artifactId" = ?1`).bind(a.id).first<{ sandboxId: string; url: string; version: number; status: string }>();
  if (row && row.version === a.version && row.status === "running" && (await runtime.alive(env, row.sandboxId))) return row.url;
  if (row) await runtime.stop(env, row.sandboxId).catch(() => {});
  const bundle = await Promise.all(files.map(async (f) => ({ path: f.path, bytes: new Uint8Array(await (await env.TRAJECTORIES.get(f.r2Key))!.arrayBuffer()) })));
  // The backend calls AnyDock exactly like the app's page does — through its own capability URL — so it gets the
  // same grants and nothing more. It never receives a user token.
  const bundleUrl = `${appBase}_bundle/${a.version}/${await bundleSig(env, a.id, a.version)}`;
  const started = await runtime.start(env, { name: `anydock-${a.id.slice(0, 8)}`, files: bundle, bundleUrl, env: { ANYDOCK_APP_URL: appBase, PORT: "3000" }, port: 3000 });
  await env.DB.prepare(`insert into "appRuntime" ("artifactId","provider","sandboxId","url","version","status","updatedAt") values (?1,?2,?3,?4,?5,'running',?6)
    on conflict ("artifactId") do update set "provider" = excluded."provider", "sandboxId" = excluded."sandboxId", "url" = excluded."url", "version" = excluded."version", "status" = 'running', "updatedAt" = excluded."updatedAt"`)
    .bind(a.id, runtime.name, started.id, started.url, a.version, now()).run();
  return started.url;
}

// ---------- the SDK served to apps ----------

const SDK = `// AnyDock app SDK — window.anydock. Everything goes through AnyDock; the app never holds a token.
(() => {
  const base = (location.pathname.match(/^\\/u\\/[^/]+\\/[^/]+\\//) || ["/"])[0];
  const enc = encodeURIComponent;
  async function j(method, path, body) {
    const r = await fetch(base + path, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const d = await r.json().catch(() => null);
    if (!r.ok && r.status !== 202) { const e = new Error((d && (d.message || d.error)) || "HTTP " + r.status); e.status = r.status; e.data = d; throw e; }
    return d;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.anydock = {
    data: {
      list: (c) => j("GET", "_api/data/" + enc(c)).then((d) => d.items),
      get: (c, k) => j("GET", "_api/data/" + enc(c) + "/" + enc(k)).then((d) => d.value, (e) => { if (e.status === 404) return null; throw e; }),
      set: (c, k, v) => j("PUT", "_api/data/" + enc(c) + "/" + enc(k), { value: v }),
      delete: (c, k) => j("DELETE", "_api/data/" + enc(c) + "/" + enc(k)),
    },
    // Recordings, photos, attachments: put(name, Blob | File | ArrayBuffer | string, contentType?) → {name, size, url}.
    // url works directly in <audio>/<video>/<img> (seekable); list(prefix?) → [{name, size, contentType, updatedAt, url}].
    files: {
      list: (prefix) => j("GET", "_api/files" + (prefix ? "?prefix=" + enc(prefix) : "")).then((d) => d.files),
      url: (name) => base + "_api/files/" + String(name).split("/").map(enc).join("/"),
      async put(name, data, type) {
        const r = await fetch(base + "_api/files/" + String(name).split("/").map(enc).join("/"), { method: "PUT", headers: { "content-type": type || (data && data.type) || "application/octet-stream" }, body: data });
        const d = await r.json().catch(() => null);
        if (!r.ok) { const e = new Error((d && (d.message || d.error)) || "HTTP " + r.status); e.status = r.status; e.data = d; throw e; }
        return d.file;
      },
      get: (name) => fetch(base + "_api/files/" + String(name).split("/").map(enc).join("/")).then((r) => (r.ok ? r.blob() : r.status === 404 ? null : Promise.reject(new Error("HTTP " + r.status)))),
      delete: (name) => j("DELETE", "_api/files/" + String(name).split("/").map(enc).join("/")),
    },
    // "edit" (people with access) · "view" (public link: read-only) · "submit" (public link: may add new entries and files)
    mode: () => j("GET", "_api/info").then((d) => d.mode),
    grants: () => j("GET", "_api/grants").then((d) => d.grants),
    // action: "slack.post" {to, text} · "email" {to, subject, body} · "text" {to, text}
    // Resolves with {status: executed | failed | denied | blocked | pending, result}; waits up to opts.waitMs for an approval.
    async call(action, payload, opts) {
      let d;
      try { d = await j("POST", "_api/call", { action, payload }); }
      catch (e) { if (e.data && e.data.action) return e.data.action; throw e; }
      const end = Date.now() + ((opts && opts.waitMs) || 60000);
      while (d.action && d.action.status === "pending" && Date.now() < end) { await sleep(2000); d = await j("GET", "_api/call/" + d.action.id); }
      return d.action;
    },
    backend: (path, init) => fetch(base + "_backend/" + String(path).replace(/^\\//, ""), init),
  };
})();
`;

