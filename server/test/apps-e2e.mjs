// App backends and narrowing permissions, end to end against local wrangler dev + a mock Blaxel on :8796.
// person → agent → app: an app gets only what an agent holds, only after the person approves the grant, and every call
// re-checks the chain (expiry, revocation, the agent's login, the person's current rule).
// Local dev must have (server/.dev.vars): BLAXEL_API_KEY=test-blaxel, BLAXEL_WORKSPACE=test-ws,
// BLAXEL_API=http://localhost:8796/v0, APP_RUNTIME=blaxel (local dev has no containers), USERCONTENT_ORIGIN=http://127.0.0.1:8787
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/apps-e2e.mjs dev.log
import { createServer } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

// ---------- mock Blaxel ----------
const bx = { creates: [], files: {}, processes: [], proxied: [], deleted: [], cpAuthOk: true, dpAuthOk: true };
const mock = createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const send = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  const url = new URL(req.url, "http://localhost:8796");
  if (url.pathname.startsWith("/v0/")) {
    if (req.headers.authorization !== "Bearer test-blaxel" || req.headers["x-blaxel-workspace"] !== "test-ws") bx.cpAuthOk = false;
    const m = url.pathname.match(/^\/v0\/sandboxes(?:\/([^/]+))?$/);
    if (m && req.method === "POST") { const j = JSON.parse(body); bx.creates.push(j); return send(200, { metadata: { name: j.metadata.name, url: `http://localhost:8796/sbx/${j.metadata.name}` }, status: "DEPLOYED" }); }
    if (m && req.method === "GET") return send(200, { metadata: { name: m[1] }, status: "DEPLOYED" });
    if (m && req.method === "DELETE") { bx.deleted.push(m[1]); return send(200, {}); }
    return send(404, { error: "nope" });
  }
  const s = url.pathname.match(/^\/sbx\/([^/]+)(\/.*)$/);
  if (!s) return send(404, {});
  if (req.headers["x-blaxel-authorization"] !== "Bearer test-blaxel") bx.dpAuthOk = false;
  const [, name, rest] = s;
  if (rest.startsWith("/filesystem/")) {
    if (req.method === "PUT") { const path = decodeURIComponent(rest.slice("/filesystem/".length)); bx.files[path] = body.toString("latin1"); return send(200, { message: "ok", path }); }
    return send(200, { path: "/" });
  }
  if (rest === "/process" && req.method === "POST") { bx.processes.push(JSON.parse(body)); return send(200, { pid: "1", status: "running" }); }
  if (rest.startsWith("/port/3000")) {
    bx.proxied.push({ name, path: rest.slice("/port/3000".length), method: req.method, cookie: req.headers.cookie ?? null, authorization: req.headers.authorization ?? null, body: body.toString() });
    return send(200, { fromBackend: true, path: rest.slice("/port/3000".length) });
  }
  send(404, {});
});
await new Promise((r) => mock.listen(8796, r));

// ---------- helpers ----------
async function call(token, method, path, body, base = BASE) {
  const res = await fetch(base + path, { method, redirect: "manual",
    headers: { origin: base, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const raw = (token, method, path, bytes, type) => fetch(BASE + path, { method, headers: { authorization: `Bearer ${token}`, "content-type": type }, body: bytes });
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`) || l === `To: ${email}`)).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
function deviceKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  return { pub: Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64"),
    sign: (m) => sign("sha256", Buffer.from(m, "utf8"), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64") };
}
async function deviceLogin(browser, pub) {
  const code = (await call(null, "POST", "/api/auth/device/code", { client_id: "anydock-cli" })).data;
  await call(browser, "GET", `/api/auth/device?user_code=${encodeURIComponent(code.user_code)}`);
  await call(browser, "POST", "/api/auth/device/approve", { userCode: code.user_code });
  return (await call(null, "POST", "/api/auth/device/token", { grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: code.device_code, client_id: "anydock-cli", approval_key: pub, approval_key_name: "Test Mac" })).data.access_token;
}
const approveAsMac = (agent, key, a) => call(agent, "POST", `/api/actions/${a.id}/decide`, { approve: true, signature: key.sign(`anydock-approve:v1\n${a.id}\n${a.userId}\n${a.summary}`) });

// ---------- setup ----------
const run = Date.now();
const nolan = await signIn(`nolan+${run}@acme.dev`);
const key = deviceKey();
const agent = await deviceLogin(nolan, key.pub);

// The agent publishes an app with a page and a backend.
const app = (await call(agent, "POST", "/api/artifacts", { title: "Launch desk", kind: "app" })).data.artifact;
const v = (await call(agent, "POST", `/api/artifacts/${app.id}/versions`)).data.version;
await raw(agent, "PUT", `/api/artifacts/${app.id}/versions/${v}/files/index.html`, "<script src='_anydock.js'></script><h1>Launch desk</h1>", "text/html");
await raw(agent, "PUT", `/api/artifacts/${app.id}/versions/${v}/files/server.js`, "require('http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)", "text/javascript");
await call(agent, "POST", `/api/artifacts/${app.id}/versions/${v}/done`);
const appUrl = (await call(agent, "GET", `/api/artifacts/${app.id}`)).data.artifact.appUrl;
const U = new URL(appUrl);
const appCall = (method, path, body) => call(null, method, U.pathname + path, body, U.origin);
check("the app runs on the separate content origin", U.origin !== BASE, U.origin);

// ---------- SDK + data store ----------
const sdk = await fetch(appUrl + "_anydock.js");
check("the app's SDK is served next to it", sdk.status === 200 && (await sdk.text()).includes("window.anydock"));
await appCall("PUT", "_api/data/tasks/t1", { value: { title: "Record demo", done: false } });
await appCall("PUT", "_api/data/tasks/t2", { value: { title: "Submit", done: false } });
const list = await appCall("GET", "_api/data/tasks");
check("data store: set and list", list.status === 200 && list.data.items.length === 2 && list.data.items.some((i) => i.value.title === "Record demo"));
check("data store: get one", (await appCall("GET", "_api/data/tasks/t1")).data.value.done === false);
await appCall("DELETE", "_api/data/tasks/t2");
check("data store: delete", (await appCall("GET", "_api/data/tasks/t2")).status === 404);
check("a wrong capability gets nothing", (await call(null, "GET", U.pathname.replace(/\/[0-9a-f]{32}\//, "/" + "0".repeat(32) + "/") + "_api/data/tasks", undefined, U.origin)).status === 404);

// ---------- calls need a grant ----------
const ungranted = await appCall("POST", "_api/call", { action: "email", payload: { to: `jason+${run}@acme.dev`, subject: "Hi", body: "x" } });
check("without a grant the app can't act", ungranted.status === 403 && ungranted.data.error === "not_granted", ungranted.data.message);

// ---------- granting: the agent asks, the person approves ----------
const req1 = await call(agent, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["email.internal"], days: 7 }, agent: "claude-code" });
check("an agent's grant request always waits for the person", req1.status === 202 && req1.data.action.status === "pending" && /Let app “Launch desk” email teammates/.test(req1.data.action.summary), req1.data.action?.summary);
const selfApprove = await call(agent, "POST", `/api/actions/${req1.data.action.id}/decide`, { approve: true });
check("the agent can't approve its own grant", selfApprove.status === 403);
const ok1 = await approveAsMac(agent, key, req1.data.action);
check("the person approves on their Mac (signed) → grant active", ok1.status === 200 && ok1.data.action.status === "executed", ok1.data.action?.result?.detail);
const grants = (await appCall("GET", "_api/grants")).data.grants;
check("the app sees what it may do", grants.length === 1 && grants[0].action === "email.internal");

const sent = await appCall("POST", "_api/call", { action: "email", payload: { to: `jason+${run}@acme.dev`, subject: "Standup", body: "Notes" } });
check("a granted call goes through AnyDock (rule allow → runs; no mailbox here, so it fails honestly)", sent.status === 200 && ["executed", "failed"].includes(sent.data.action.status) && /by app “Launch desk”/.test(sent.data.action.summary), sent.data.action?.result?.detail);
const ext = await appCall("POST", "_api/call", { action: "email", payload: { to: "partner@other.com", subject: "Hi", body: "x" } });
check("an action it wasn't given is refused", ext.status === 403 && ext.data.error === "not_granted");

// ---------- narrowing: can't give what you don't have ----------
await call(nolan, "PUT", "/api/delegate/policy", { action: "phone.text", decision: "deny" });
const nope = await call(agent, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["phone.text"] } });
check("an agent can't grant what the person's rules deny it", nope.status === 403 && nope.data.error === "not_yours", nope.data.message);
check("granting can never be set to allow", (await call(nolan, "PUT", "/api/delegate/policy", { action: "app.grant", decision: "allow" })).status === 400);

// ---------- scope + the person's rule still applies ----------
const req2 = await call(agent, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["email.external"], to: ["partner@other.com"], days: 1 } });
await approveAsMac(agent, key, req2.data.action);
const outOfScope = await appCall("POST", "_api/call", { action: "email", payload: { to: "someone@else.com", subject: "x", body: "x" } });
check("a scoped grant refuses other recipients", outOfScope.status === 403 && /only/.test(outOfScope.data.message), outOfScope.data.message);
const inScope = await appCall("POST", "_api/call", { action: "email", payload: { to: "partner@other.com", subject: "Proposal", body: "x" } });
check("in scope, the person's 'ask me' rule still makes it wait", inScope.status === 202 && inScope.data.action.status === "pending");
const inbox = (await call(nolan, "GET", "/api/actions?status=pending")).data.actions;
check("…and it's in the person's Inbox, labelled as the app", inbox.some((a) => a.agent === "app: Launch desk"));
await call(nolan, "POST", `/api/actions/${inScope.data.action.id}/decide`, { approve: true });
const after = await appCall("GET", `_api/call/${inScope.data.action.id}`);
check("the app can poll its request's outcome", after.status === 200 && after.data.action.status !== "pending");
check("…but sees no user ids", !JSON.stringify(after.data).includes("userId"));

// ---------- the backend runs in the sandbox, behind the same rules ----------
const be = await appCall("POST", "_backend/api/hello?x=1", { hi: 1 });
check("backend requests are proxied to the sandbox", be.status === 200 && be.data.fromBackend === true && be.data.path === "/api/hello", JSON.stringify(be.data));
check("Blaxel control plane got key + workspace headers", bx.cpAuthOk && bx.creates.length === 1 && bx.creates[0].spec.runtime.ports[0].target === 3000);
check("the app's files were written and server.js started on $PORT", Object.keys(bx.files).includes("/app/server.js") && bx.processes.some((p) => p.command === "node server.js" && p.env.PORT === "3000"));
const startEnv = bx.processes.find((p) => p.command === "node server.js").env;
check("the backend gets the app's own capability URL, never a token", startEnv.ANYDOCK_APP_URL === appUrl && !JSON.stringify(startEnv).match(/Bearer|token/i));
check("sandbox calls carry Blaxel's auth; the viewer's cookies/auth never reach it", bx.dpAuthOk && bx.proxied.every((p) => !p.cookie && !p.authorization));
await appCall("GET", "_backend/again");
check("the running sandbox is reused", bx.creates.length === 1 && bx.proxied.length === 2);

// ---------- revocation cascades ----------
const list2 = (await call(nolan, "GET", `/api/artifacts/${app.id}/grants`)).data.grants;
check("the person sees every grant, who gave it and how", list2.length === 2 && list2.every((g) => g.viaAgent && g.status === "active"));
await call(agent, "POST", "/api/auth/sign-out", {});
const dead = await appCall("POST", "_api/call", { action: "email", payload: { to: `jason+${run}@acme.dev`, subject: "x", body: "x" } });
check("signing the agent out kills every grant it made", dead.status === 403 && dead.data.error === "not_granted");
const direct = await call(nolan, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["email.internal"], days: 1 } });
check("the person can grant directly from the dashboard", direct.status === 200 && direct.data.action.status === "executed");
const gid = (await call(nolan, "GET", `/api/artifacts/${app.id}/grants`)).data.grants.find((g) => g.status === "active").id;
await call(nolan, "DELETE", `/api/artifacts/${app.id}/grants/${gid}`);
check("revoking a grant stops the app at once", (await appCall("POST", "_api/call", { action: "email", payload: { to: `jason+${run}@acme.dev`, subject: "x", body: "x" } })).status === 403);

mock.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
