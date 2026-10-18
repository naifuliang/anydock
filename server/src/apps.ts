import { Hono, type Context } from "hono";
import { appSig, type ArtifactRow } from "./artifacts.ts";
import { ACTIONS, actionJson, classify, requestAction, type ActionRow, type Grantable } from "./delegate.ts";
import { sandboxRuntime } from "./sandbox.ts";
import { hmacHex } from "./secure.ts";
import type { AppEnv, Env, User } from "./types.ts";

// The backend every app (artifact kind app/html) gets, on its own origin under /u/<id>/<capability>/:
//   _anydock.js                 the client SDK (window.anydock)
//   _api/data/<collection>[/key]  a small shared data store (JSON values)
//   _api/call                   act through AnyDock — only what the app was granted (person → agent → app, narrowing)
//   _backend/*                  the app's own server code, running in a sandbox (sandbox.ts), behind the same rules
// No cookies, no tokens: the capability URL identifies the app, and every call is checked against its grants.
export const apps = new Hono<AppEnv>();

const now = () => new Date().toISOString();
const MAX_VALUE = 64 * 1024;
const MAX_ROWS = 5000;

type Grant = { id: string; artifactId: string; userId: string; grantorSessionId: string | null; action: Grantable; scope: string | null; expiresAt: string; createdAt: string };

async function app(c: Context<AppEnv>): Promise<ArtifactRow | Response> {
  const content = c.env.USERCONTENT_ORIGIN;
  if (content?.startsWith("https://") && new URL(c.req.url).host !== new URL(content).host) return c.json({ error: "not_found" }, 404);
  const id = c.req.param("id")!;
  if (c.req.param("sig") !== (await appSig(c.env, id))) return c.json({ error: "not_found" }, 404);
  const a = await c.env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(id).first<ArtifactRow>();
  if (!a || (a.kind !== "app" && a.kind !== "html")) return c.json({ error: "not_found" }, 404);
  return a;
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
  const a = await app(c);
  if (a instanceof Response) return a;
  return new Response(SDK, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } });
});

// ---------- data ----------

const okName = (s: string) => s.length > 0 && s.length <= 100;

apps.get("/u/:id/:sig/_api/data/:collection", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const { results } = await c.env.DB.prepare(`select "key","value","updatedAt" from "appData" where "artifactId" = ?1 and "collection" = ?2 order by "updatedAt" desc limit 1000`)
    .bind(a.id, c.req.param("collection")).all<{ key: string; value: string; updatedAt: string }>();
  return c.json({ items: results.map((r) => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updatedAt })) });
});

apps.get("/u/:id/:sig/_api/data/:collection/:key", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const r = await c.env.DB.prepare(`select "value","updatedAt" from "appData" where "artifactId" = ?1 and "collection" = ?2 and "key" = ?3`)
    .bind(a.id, c.req.param("collection"), c.req.param("key")).first<{ value: string; updatedAt: string }>();
  return r ? c.json({ value: JSON.parse(r.value), updatedAt: r.updatedAt }) : c.json({ error: "not_found" }, 404);
});

apps.put("/u/:id/:sig/_api/data/:collection/:key", async (c) => {
  const a = await app(c);
  if (a instanceof Response) return a;
  const collection = c.req.param("collection"), key = c.req.param("key");
  if (!okName(collection) || !okName(key)) return c.json({ error: "bad_name", message: "Collection and key: 1–100 characters." }, 400);
  const body = (await c.req.json().catch(() => null)) as { value?: unknown } | null;
  if (!body || !("value" in body)) return c.json({ error: "invalid_body", message: 'Send {"value": …}' }, 400);
  const value = JSON.stringify(body.value);
  if (value.length > MAX_VALUE) return c.json({ error: "too_large", message: "Values are limited to 64 KB." }, 413);
  const count = await c.env.DB.prepare(`select count(*) as n from "appData" where "artifactId" = ?1`).bind(a.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_ROWS) return c.json({ error: "full", message: `This app's data store is full (${MAX_ROWS} values).` }, 413);
  const ts = now();
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

// ---------- grants + calls ----------

apps.get("/u/:id/:sig/_api/grants", async (c) => {
  const a = await app(c);
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
  const a = await app(c);
  if (a instanceof Response) return a;
  const files = await c.env.DB.prepare(`select "path","r2Key" from "artifactFile" where "artifactId" = ?1 and "version" = ?2`).bind(a.id, a.version).all<{ path: string; r2Key: string }>();
  const entry = files.results.find((f) => f.path === "server.js" || f.path === "server/index.js" || f.path === "package.json");
  if (!entry) return c.json({ error: "no_backend", message: "This app has no backend (add server.js that listens on $PORT)." }, 404);
  const runtime = sandboxRuntime(c.env);
  if (!runtime) return c.json({ error: "runtime_not_configured", message: "App backends run in a sandbox (Blaxel or Cloudflare Containers), and neither is configured on this server." }, 503);
  const url = await ensureBackend(c.env, runtime, a, files.results, `${c.env.USERCONTENT_ORIGIN ?? new URL(c.req.url).origin}${base(c)}`);
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

