// Agent tokens can't approve: end-to-end against local wrangler dev.
// A CLI (device-flow) token is an agent token: it may request and deny actions, but approving needs a signature from the
// device key enrolled at sign-in (Touch ID / password on a Mac), and rule / connector / login changes need the person.
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/agent-trust-e2e.mjs dev.log
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, { method, redirect: "manual",
    headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`) || l === `To: ${email}`)).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
// The CLI's device flow, approved by the person in their browser session; optionally enrolls an approval key.
async function deviceLogin(browser, publicKey) {
  const code = (await call(null, "POST", "/api/auth/device/code", { client_id: "anydock-cli" })).data;
  await call(browser, "GET", `/api/auth/device?user_code=${encodeURIComponent(code.user_code)}`);
  const approved = await call(browser, "POST", "/api/auth/device/approve", { userCode: code.user_code });
  if (approved.status !== 200) throw new Error(`approve failed ${approved.status} ${JSON.stringify(approved.data)}`);
  const tok = await call(null, "POST", "/api/auth/device/token", {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code", device_code: code.device_code, client_id: "anydock-cli",
    ...(publicKey ? { approval_key: publicKey, approval_key_name: "Test Mac" } : {}),
  });
  return tok.data.access_token;
}
function deviceKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
  return { pub: raw.toString("base64"), sign: (msg) => sign("sha256", Buffer.from(msg, "utf8"), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64") };
}
const message = (a) => `anydock-approve:v1\n${a.id}\n${a.userId}\n${a.summary}`;
const ask = async (tok, n) => (await call(tok, "POST", "/api/actions", { action: "email", payload: { to: "partner@gmail.com", subject: `Proposal ${n}`, body: "hi" }, agent: "claude-code" })).data.action;

const run = Date.now();
const browser = await signIn(`alice+${run}@acme.dev`);
const key = deviceKey();
const agent = await deviceLogin(browser, key.pub);
const agentNoKey = await deviceLogin(browser);

// Who is who.
const meA = (await call(agent, "GET", "/api/me")).data;
const meB = (await call(browser, "GET", "/api/me")).data;
check("device-flow token is an agent token with the enrolled key", meA.agent === true && meA.approvalKey?.name === "Test Mac", JSON.stringify(meA));
check("browser session is not an agent", meB.agent === false);

// Agent powers: request + deny.
const a1 = await ask(agent, 1);
check("agent can request an action (pending)", a1?.status === "pending", a1?.status);
const noSig = await call(agent, "POST", `/api/actions/${a1.id}/decide`, { approve: true, via: "mac" });
check("agent token can't approve without a signature (claiming via mac)", noSig.status === 403 && noSig.data.error === "human_required");
const viaAgent = await call(agent, "POST", `/api/actions/${a1.id}/decide`, { approve: true, via: "agent" });
check("agent token can't approve as the in-agent prompt either", viaAgent.status === 403);
const forged = await call(agent, "POST", `/api/actions/${a1.id}/decide`, { approve: true, signature: deviceKey().sign(message(a1)) });
check("a signature from another key is rejected", forged.status === 403);
const wrongMsg = await call(agent, "POST", `/api/actions/${a1.id}/decide`, { approve: true, signature: key.sign(message({ ...a1, summary: "something harmless" })) });
check("a signature over a different summary is rejected", wrongMsg.status === 403);
const stillPending = (await call(browser, "GET", `/api/actions/${a1.id}`)).data.action;
check("…and the request is still pending", stillPending.status === "pending");
const good = await call(agent, "POST", `/api/actions/${a1.id}/decide`, { approve: true, signature: key.sign(message(a1)) });
check("the enrolled device's signature approves it, recorded as via mac", good.status === 200 && good.data.action.decidedVia === "mac" && good.data.action.status !== "pending", JSON.stringify(good.data?.action?.status));

const a2 = await ask(agentNoKey, 2);
const otherKey = await call(agentNoKey, "POST", `/api/actions/${a2.id}/decide`, { approve: true, signature: key.sign(message(a2)) });
check("a session without its own key can't borrow another session's key", otherKey.status === 403);
const deny = await call(agentNoKey, "POST", `/api/actions/${a2.id}/decide`, { approve: false });
check("agent token can deny", deny.status === 200 && deny.data.action.status === "denied" && deny.data.action.decidedVia === "agent");

const a3 = await ask(agent, 3);
const human = await call(browser, "POST", `/api/actions/${a3.id}/decide`, { approve: true, via: "mac" });
check("the person in the browser can approve (recorded as dashboard, not what the client claims)", human.status === 200 && human.data.action.decidedVia === "dashboard");

// Human-only routes.
const forbidden = [
  ["PUT", "/api/delegate/policy", { action: "email.external", decision: "allow" }],
  ["PUT", "/api/me/profile", { phone: "+14155550123", textOnHandover: true }],
  ["GET", "/api/connectors/slack/start"],
  ["DELETE", "/api/connectors/gmail"],
  ["POST", "/api/auth/device/approve", { userCode: "ABCDEFGH" }],
  ["POST", "/api/auth/update-user", { name: "Mallory" }],
  ["GET", "/api/auth/list-sessions"],
];
for (const [m, p, b] of forbidden) {
  const r = await call(agent, m, p, b);
  check(`agent token blocked: ${m} ${p}`, r.status === 403 && r.data?.error === "human_required", String(r.status));
}
const policyHuman = await call(browser, "PUT", "/api/delegate/policy", { action: "email.external", decision: "ask" });
check("the person can still change rules", policyHuman.status === 200);
const sess = await call(agent, "GET", "/api/auth/get-session");
check("agent token can still read its own session", sess.status === 200 && sess.data?.user);

// An agent can't mint itself a new login + key: approving a device code needs the person.
const code = (await call(null, "POST", "/api/auth/device/code", { client_id: "anydock-cli" })).data;
const claim = await call(agent, "GET", `/api/auth/device?user_code=${encodeURIComponent(code.user_code)}`);
const selfApprove = await call(agent, "POST", "/api/auth/device/approve", { userCode: code.user_code });
check("agent token can't claim or approve a new CLI login", claim.status === 403 && selfApprove.status === 403);

// One-time sign-in links: an agent opens an artifact in its host's built-in browser, signed in — as an agent.
const link = await call(agent, "POST", "/api/sign-in-link", { next: "/app#/artifacts" });
check("agent gets a one-time sign-in link", link.status === 200 && /\/l\/[^?]+\?next=/.test(link.data.url), link.data?.url);
const path = new URL(link.data.url).pathname + new URL(link.data.url).search;
const first = await fetch(BASE + path, { redirect: "manual" });
const cookie = first.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
check("opening it signs the browser in and goes to the page", first.status === 302 && first.headers.get("location") === "/app#/artifacts" && cookie.includes("session_token"));
const meCookie = await (await fetch(BASE + "/api/me", { headers: { cookie } })).json();
check("…as the same agent session (agent powers only)", meCookie.agent === true && meCookie.user.id === meA.user.id);
const a4 = await ask(agent, 4);
const viaCookie = await fetch(BASE + `/api/actions/${a4.id}/decide`, { method: "POST", headers: { cookie, origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ approve: true }) });
check("so that browser can't approve either", viaCookie.status === 403);
const again = await fetch(BASE + path, { redirect: "manual" });
check("the link works once", again.status === 302 && again.headers.get("location").startsWith("/login"));
const offsite = await call(agent, "POST", "/api/sign-in-link", { next: "https://evil.example/x" });
check("it only redirects within AnyDock", decodeURIComponent(offsite.data.url).endsWith("next=/"));
check("the plugin's own endpoints aren't callable by clients", (await call(browser, "GET", "/api/auth/one-time-token/generate")).status === 400);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
