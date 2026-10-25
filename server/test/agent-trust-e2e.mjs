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

// Deleting an artifact: the agent's own → it asks (Touch ID); someone else's → refused outright; never pre-allowed.
const mine = (await call(browser, "POST", "/api/artifacts", { title: `Scratch ${run}`, kind: "doc", content: "# x" })).data.artifact;
const bob = await signIn(`bob+${run}@acme.dev`);
const theirs = (await call(bob, "POST", "/api/artifacts", { title: `Bob's ${run}`, kind: "doc", content: "# y" })).data.artifact;
await call(bob, "POST", `/api/artifacts/${theirs.id}/share`, { to: `alice+${run}@acme.dev`, role: "editor" });
check("agent can't DELETE an artifact directly", (await call(agent, "DELETE", `/api/artifacts/${mine.id}`)).status === 403);
const delMine = await call(agent, "POST", "/api/actions", { action: "artifact.delete", payload: { artifactId: mine.id }, agent: "claude-code", session: { source: "claude-code", sessionId: `s-${run}` } });
check("deleting its own artifact asks the person", delMine.status === 202 && delMine.data.action.status === "pending" && delMine.data.action.action === "artifact.delete", JSON.stringify(delMine.data));
const delTheirs = await call(agent, "POST", "/api/actions", { action: "artifact.delete", payload: { artifactId: theirs.id }, agent: "claude-code" });
check("someone else's artifact (even with edit access): refused, nobody asked", delTheirs.status === 403 && delTheirs.data.error === "forbidden", JSON.stringify(delTheirs.data));
check("…and it's still there", (await call(bob, "GET", `/api/artifacts/${theirs.id}`)).status === 200);
check("a rule can't pre-allow deleting", (await call(browser, "PUT", "/api/delegate/policy", { action: "artifact.delete", decision: "allow" })).status === 400);
const sessDel = await call(browser, "POST", `/api/actions/${delMine.data.action.id}/decide`, { approve: true, scope: "session" });
check("approved → deleted for everyone", sessDel.status === 200 && sessDel.data.action.status === "executed" && (await call(browser, "GET", `/api/artifacts/${mine.id}`)).status === 404, JSON.stringify(sessDel.data.action?.result));
const mine2 = (await call(browser, "POST", "/api/artifacts", { title: `Scratch2 ${run}`, kind: "doc", content: "# x" })).data.artifact;
const delAgain = await call(agent, "POST", "/api/actions", { action: "artifact.delete", payload: { artifactId: mine2.id }, agent: "claude-code", session: { source: "claude-code", sessionId: `s-${run}` } });
check("\"this session\" never carries over to deleting", delAgain.status === 202);

// Public links: the owner turns it on in the browser; agents must ask (Touch ID by default); anyone with the link can read.
const pubDoc = (await call(browser, "POST", "/api/artifacts", { title: `Public ${run}`, kind: "doc", content: "# Hello\nVisible to anyone with the link." })).data.artifact;
const pubOn = await call(browser, "POST", `/api/artifacts/${pubDoc.id}/public`, { on: true });
check("owner turns on a public link from the browser", pubOn.status === 200 && /\/p\/[\w-]{20,}$/.test(pubOn.data.publicUrl), JSON.stringify(pubOn.data));
const tok = pubOn.data.publicUrl.split("/p/")[1];
const page = await fetch(`${BASE}/p/${tok}`, { redirect: "manual" });
check("anyone can open /p/<token> without signing in", page.status === 200 && (await page.text()).includes('"pt":'));
const anon = await call(null, "GET", `/api/artifacts/${pubDoc.id}?pt=${tok}`);
check("…and read it, read-only, without shares, history or the link itself", anon.status === 200 && anon.data.artifact.access === "view" && anon.data.shares.length === 0 && anon.data.events.length === 0 && !anon.data.artifact.publicUrl && anon.data.sections.some((x) => x.body.includes("Visible")), JSON.stringify(anon.data?.artifact));
check("a wrong token reads nothing", (await call(null, "GET", `/api/artifacts/${pubDoc.id}?pt=nope`)).status === 404);
check("the public token can't write", (await call(null, "PUT", `/api/artifacts/${pubDoc.id}/content?pt=${tok}`, { content: "# hacked" })).status === 401);
check("…or list anything", (await call(null, "GET", `/api/artifacts?pt=${tok}`)).status === 401);
const mine2pub = (await call(browser, "POST", "/api/artifacts", { title: `Agent public ${run}`, kind: "doc", content: "# x" })).data.artifact;
check("an agent can't flip a public link on directly", (await call(agent, "POST", `/api/artifacts/${mine2pub.id}/public`, { on: true })).status === 403);
const askPub = await call(agent, "POST", "/api/actions", { action: "artifact.publish", payload: { artifactId: mine2pub.id }, agent: "claude-code" });
check("it asks instead (default: ask me)", askPub.status === 202 && askPub.data.action.status === "pending", JSON.stringify(askPub.data));
check("…and can't approve its own request without the device signature", (await call(agent, "POST", `/api/actions/${askPub.data.action.id}/decide`, { approve: true, via: "mac" })).status === 403);
const once = await call(agent, "POST", `/api/actions/${askPub.data.action.id}/decide`, { approve: true, signature: key.sign(message(askPub.data.action)) });
check("asks twice: a plain Touch ID signature isn't enough to go public", once.status === 403, String(once.status));
check("…\"this session\" is refused for it", (await call(agent, "POST", `/api/actions/${askPub.data.action.id}/decide`, { approve: true, scope: "session", signature: key.sign(message(askPub.data.action).replace("anydock-approve:v1", "anydock-approve-session:v1")) })).status === 400);
check("…and no rule can pre-allow it", (await call(browser, "PUT", "/api/delegate/policy", { action: "artifact.publish", decision: "allow" })).status === 400);
const signedPub = await call(agent, "POST", `/api/actions/${askPub.data.action.id}/decide`, { approve: true, signature: key.sign(message(askPub.data.action).replace("anydock-approve:v1", "anydock-approve-confirmed:v1")) });
check("the panel's confirmed signature (after its second dialog) makes it public and returns the link", signedPub.status === 200 && signedPub.data.action.status === "executed" && /\/p\//.test(signedPub.data.action.result?.publicUrl || ""), JSON.stringify(signedPub.data.action?.result));
const bobDoc = (await call(bob, "POST", "/api/artifacts", { title: `Bob pub ${run}`, kind: "doc", content: "# b" })).data.artifact;
await call(bob, "POST", `/api/artifacts/${bobDoc.id}/share`, { to: `alice+${run}@acme.dev`, role: "editor" });
check("only the owner's artifacts can be made public", (await call(agent, "POST", "/api/actions", { action: "artifact.publish", payload: { artifactId: bobDoc.id } })).status === 403);
check("turning it off needs no approval (it only narrows)", (await call(agent, "POST", `/api/artifacts/${pubDoc.id}/public`, { on: false })).status === 200);
check("…and the link stops working", (await fetch(`${BASE}/p/${tok}`, { redirect: "manual" })).status === 404 && (await call(null, "GET", `/api/artifacts/${pubDoc.id}?pt=${tok}`)).status === 404);

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
