// Per agent session permissions, end to end against local wrangler dev.
// Each agent session inherits the person's rules; it can be narrowed (by the person or by its own agent), or allowed
// more — only by the person, e.g. approving "for this session" — and never beyond the person's deny.
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/sessions-e2e.mjs dev.log
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
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
const msg = (a, scope) => `${scope === "session" ? "anydock-approve-session:v1" : "anydock-approve:v1"}\n${a.id}\n${a.userId}\n${a.summary}`;

const run = Date.now();
const browser = await signIn(`nolan+${run}@acme.dev`);
// The person chooses Allow for these (the defaults ask every time).
for (const k of ["slack.post", "email.internal"]) await call(browser, "PUT", "/api/delegate/policy", { action: k, decision: "allow" });
const key = deviceKey();
const agent = await deviceLogin(browser, key.pub);
const A = { source: "claude-code", sessionId: `sess-a-${run}` }, B = { source: "codex", sessionId: `sess-b-${run}` };
const ask = (session, to, subject = "Hi") => call(agent, "POST", "/api/actions", { action: "email", payload: { to, subject, body: "x" }, agent: "claude-code", session });

// ---------- approve for this session ----------
const r1 = (await ask(A, "partner@other.com", "One")).data.action;
check("an outside email from session A asks first, and the request knows its session", r1.status === "pending" && r1.sessionId === A.sessionId);
const replayUp = await call(agent, "POST", `/api/actions/${r1.id}/decide`, { approve: true, scope: "session", signature: key.sign(msg(r1, "once")) });
check("a one-time signature can't be used as a session approval", replayUp.status === 403);
const ok1 = await call(agent, "POST", `/api/actions/${r1.id}/decide`, { approve: true, scope: "session", signature: key.sign(msg(r1, "session")) });
check("Touch ID 'This session' (session-signed) approves it", ok1.status === 200 && ok1.data.action.status !== "pending" && /this session/.test(ok1.data.action.decidedVia), ok1.data.action?.decidedVia);
const r2 = (await ask(A, "someone@else.com", "Two")).data.action;
check("…so the same session doesn't ask again for that kind of action", r2.status !== "pending" && r2.decidedVia === "session rule", r2.decidedVia);
const r3 = (await ask(B, "partner@other.com", "Three")).data.action;
check("another session still asks", r3.status === "pending");
const replayDown = await call(agent, "POST", `/api/actions/${r3.id}/decide`, { approve: true, scope: "once", signature: key.sign(msg(r3, "session")) });
check("a session signature can't be passed off as a one-time approval either", replayDown.status === 403);
await call(browser, "POST", `/api/actions/${r3.id}/decide`, { approve: true });
const r4 = (await ask(B, "x@other.com", "Four")).data.action;
check("approving once in the dashboard doesn't open up the session", r4.status === "pending");
await call(browser, "POST", `/api/actions/${r4.id}/decide`, { approve: true, scope: "session" });
check("…approving 'This session' in the dashboard does", (await ask(B, "y@other.com", "Five")).data.action.decidedVia === "session rule");

// ---------- narrowing one session ----------
const narrow = await call(agent, "PUT", "/api/sessions/rule", { ...A, action: "email.internal", decision: "deny" });
check("an agent can narrow its own session", narrow.status === 200);
const internalA = await ask(A, `jason+${run}@acme.dev`);
check("…teammate email from that session is now blocked", internalA.status === 403 && internalA.data.action.status === "blocked");
const internalB = await ask(B, `jason+${run}@acme.dev`);
check("…other sessions keep the person's rule (allow)", internalB.status === 200 && internalB.data.action.status !== "blocked");
check("an agent can't allow more for a session", (await call(agent, "PUT", "/api/sessions/rule", { ...A, action: "phone.text", decision: "allow" })).data?.error === "human_required");
check("an agent can't drop a session's restrictions", (await call(agent, "DELETE", `/api/sessions/rules?source=${A.source}&sessionId=${A.sessionId}`)).status === 403);
const eff = (await call(agent, "GET", `/api/sessions/effective?source=${A.source}&sessionId=${A.sessionId}`)).data.actions;
check("an agent can see what its session may do", eff["email.internal"].decision === "deny" && eff["email.internal"].bySession && eff["email.external"].decision === "allow");

// ---------- the person's deny always wins ----------
await call(browser, "PUT", "/api/delegate/policy", { action: "email.external", decision: "deny" });
const afterDeny = await ask(A, "partner@other.com");
check("a session allow never beats the person's deny", afterDeny.status === 403 && afterDeny.data.action.status === "blocked");
await call(browser, "PUT", "/api/delegate/policy", { action: "email.external", decision: "ask" });

// ---------- granting to apps is never session-allowed ----------
const app = (await call(agent, "POST", "/api/artifacts", { title: "Desk", kind: "app" })).data.artifact;
const g1 = (await call(agent, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["email.internal"] }, session: B })).data.action;
await call(browser, "POST", `/api/actions/${g1.id}/decide`, { approve: true, scope: "session" });
const g2 = (await call(agent, "POST", "/api/actions", { action: "app.grant", payload: { artifactId: app.id, actions: ["email.internal"] }, session: B })).data.action;
check("granting to an app asks every time, even after 'This session'", g2.status === "pending");

// ---------- the person's view ----------
const sessions = (await call(browser, "GET", "/api/sessions")).data.sessions;
const sa = sessions.find((s) => s.sessionId === A.sessionId), sb = sessions.find((s) => s.sessionId === B.sessionId);
check("the person sees each session, its device and its own rules", sa && sb && sa.device === "Test Mac" && sa.rules.some((r) => r.action === "email.internal" && r.decision === "deny") && sb.rules.some((r) => r.decision === "allow"));
await call(browser, "DELETE", `/api/sessions/rules?source=${A.source}&sessionId=${A.sessionId}`);
check("'Back to my rules' resets a session", (await ask(A, `jason+${run}@acme.dev`)).data.action.status !== "blocked" && (await ask(A, "z@other.com")).data.action.status === "pending");
const loud = await call(browser, "POST", "/api/actions", { action: "email", payload: { to: "p@other.com", subject: "x", body: "x" }, session: A });
check("a browser can't claim to be an agent session", loud.data.action.sessionId === null);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
