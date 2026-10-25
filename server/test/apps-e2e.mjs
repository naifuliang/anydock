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
// The person chooses Allow for these (the defaults ask every time).
for (const k of ["slack.post", "email.internal"]) await call(nolan, "PUT", "/api/delegate/policy", { action: k, decision: "allow" });
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

// ---------- files + bigger values ----------
const putFile = (base, name, bytes, type) => fetch(base + "_api/files/" + name, { method: "PUT", headers: { "content-type": type }, body: bytes });
const audio = new Uint8Array(3 * 1024 * 1024).map((_, i) => i % 251);
const up = await putFile(appUrl, "recordings/standup%201.webm", audio, "audio/webm");
const upJ = await up.json();
check("files: upload a 3 MB recording", up.status === 201 && upJ.file.size === audio.length && upJ.file.name === "recordings/standup 1.webm", JSON.stringify(upJ).slice(0, 200));
const fl = await appCall("GET", "_api/files?prefix=recordings/");
check("files: list by prefix, with usage", fl.status === 200 && fl.data.files.length === 1 && fl.data.used === audio.length && fl.data.limit === 2 * 1024 ** 3);
const part = await fetch(appUrl + "_api/files/recordings/standup%201.webm", { headers: { range: "bytes=1000-1999" } });
const pb = new Uint8Array(await part.arrayBuffer());
check("files: byte ranges (seekable audio/video)", part.status === 206 && pb.length === 1000 && pb[0] === 1000 % 251 && part.headers.get("content-type") === "audio/webm");
const whole = await fetch(appUrl + "_api/files/recordings/standup%201.webm");
check("files: whole file back, sandboxed", whole.status === 200 && (await whole.arrayBuffer()).byteLength === audio.length && whole.headers.get("content-security-policy") === "sandbox");
await putFile(appUrl, "evil.html", "<script>alert(1)</script>", "text/html");
check("files: a stored .html is never served as a document", (await fetch(appUrl + "_api/files/evil.html")).headers.get("content-type") === "application/octet-stream");
check("files: bad names refused", (await putFile(appUrl, "a//b", "x", "text/plain")).status === 400);
const big = { notes: "x".repeat(500 * 1024) };
check("data store: values up to 1 MB", (await appCall("PUT", "_api/data/notes/long", { value: big })).status === 200);
check("data store: over 1 MB refused", (await appCall("PUT", "_api/data/notes/huge", { value: "x".repeat(1100 * 1024) })).status === 413);
check("files: delete", (await appCall("DELETE", "_api/files/evil.html")).status === 200 && (await fetch(appUrl + "_api/files/evil.html")).status === 404);

// ---------- public link: read-only app, submissions, access requests ----------
const agent2 = await deviceLogin(nolan, deviceKey().pub); // the first agent was signed out above
const pubUrl = (await call(nolan, "POST", `/api/artifacts/${app.id}/public`, { on: true })).data.publicUrl;
const pt = pubUrl.split("/p/")[1];
const pubView = (await call(null, "GET", `/api/artifacts/${app.id}?pt=${pt}`)).data.artifact;
const RO = pubView.appUrl;
check("a public viewer gets a different, read-only app link", RO && RO !== appUrl && pubView.viaLink === true && pubView.publicSubmit === false);
const roCall = (method, path, body) => call(null, method, new URL(RO).pathname + path, body, new URL(RO).origin);
check("read-only link: the app loads and reads its data", (await fetch(RO + "_anydock.js")).status === 200 && (await roCall("GET", "_api/data/tasks")).data.items.length === 1);
check("read-only link: mode is view", (await roCall("GET", "_api/info")).data.mode === "view");
check("read-only link: can't write data", (await roCall("PUT", "_api/data/tasks/x", { value: 1 })).status === 403);
check("read-only link: can't upload files", (await putFile(RO, "x.txt", "x", "text/plain")).status === 403);
check("read-only link: can't act through grants or reach the backend", (await roCall("POST", "_api/call", { action: "email", payload: {} })).status === 403 && (await roCall("GET", "_backend/x")).status === 403);
check("agents can't turn on submissions", (await call(agent2, "POST", `/api/artifacts/${app.id}/public-submit`, { on: true })).status === 403);
const subOn = await call(nolan, "POST", `/api/artifacts/${app.id}/public-submit`, { on: true });
check("the owner turns on submissions", subOn.status === 200 && (await roCall("GET", "_api/info")).data.mode === "submit");
check("submissions: a visitor adds a new entry", (await roCall("PUT", "_api/data/responses/r1", { value: { name: "Ada" } })).status === 200);
check("submissions: but can't overwrite one", (await roCall("PUT", "_api/data/tasks/t1", { value: { hacked: true } })).status === 409 && (await appCall("GET", "_api/data/tasks/t1")).data.value.done === false);
check("submissions: or delete", (await roCall("DELETE", "_api/data/responses/r1")).status === 403);
check("submissions: a visitor uploads a recording", (await putFile(RO, "voice/ada.webm", new Uint8Array(1000), "audio/webm")).status === 201);
check("submissions: can't replace someone's file", (await putFile(RO, "recordings/standup%201.webm", "x", "audio/webm")).status === 409);
check("submissions: still no grants", (await roCall("POST", "_api/call", { action: "email", payload: {} })).status === 403);
await call(nolan, "POST", `/api/artifacts/${app.id}/public-submit`, { on: false });
check("submissions off → read-only again", (await roCall("PUT", "_api/data/responses/r2", { value: 1 })).status === 403);
// access request from the public link
const jason = await signIn(`jason+${run}@acme.dev`);
check("someone without access can't open the app's page data", (await call(jason, "GET", `/api/artifacts/${app.id}`)).status === 404);
const jv = await call(jason, "GET", `/api/artifacts/${app.id}?pt=${pt}`);
check("…but a signed-in visitor with the link gets the read-only view", jv.status === 200 && jv.data.artifact.viaLink === true && jv.data.artifact.appUrl === RO);
check("anonymous visitors must sign in to request access", (await call(null, "POST", `/api/artifacts/${app.id}/access-requests`, { pt, role: "editor" })).status === 401);
check("a wrong link token can't request", (await call(jason, "POST", `/api/artifacts/${app.id}/access-requests`, { pt: "nope", role: "editor" })).status === 404);
const rq = await call(jason, "POST", `/api/artifacts/${app.id}/access-requests`, { pt, role: "editor", note: "Can I help?" });
check("a signed-in visitor requests edit access", rq.status === 201 && rq.data.request.status === "pending");
check("…once (a repeat returns the same request)", (await call(jason, "POST", `/api/artifacts/${app.id}/access-requests`, { pt, role: "editor" })).data.request.id === rq.data.request.id);
const ownerInbox = (await call(nolan, "GET", "/api/inbox")).data.items ?? [];
check("the owner gets it in their Inbox", ownerInbox.some((i) => i.kind === "artifact.access_request" && i.artifactId === app.id));
const reqs = (await call(nolan, "GET", `/api/artifacts/${app.id}/access-requests`)).data.requests;
check("the owner sees pending requests", reqs.length === 1 && reqs[0].note === "Can I help?");
check("the owner's agent can't decide it", (await call(agent2, "POST", `/api/artifacts/${app.id}/access-requests/${rq.data.request.id}`, { approve: true })).status === 403);
const ok = await call(nolan, "POST", `/api/artifacts/${app.id}/access-requests/${rq.data.request.id}`, { approve: true, role: "viewer" });
check("the owner approves (as viewer)", ok.status === 200 && ok.data.role === "viewer");
const jv2 = await call(jason, "GET", `/api/artifacts/${app.id}`);
check("…and the requester now has that access", jv2.status === 200 && jv2.data.artifact.access === "view" && jv2.data.artifact.appUrl === appUrl);
check("a decided request can't be decided again", (await call(nolan, "POST", `/api/artifacts/${app.id}/access-requests/${rq.data.request.id}`, { approve: true })).status === 409);
await call(nolan, "POST", `/api/artifacts/${app.id}/public`, { on: false });
check("turning the public link off kills the read-only app link", (await fetch(RO + "_anydock.js")).status === 404 && (await roCall("GET", "_api/data/tasks")).status === 404);

mock.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
