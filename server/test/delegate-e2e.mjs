// End-to-end test of delegate (rules, approvals, Slack connector, email) against local wrangler dev + a mock Slack on :8798.
// Local dev must have (server/.dev.vars): SLACK_CLIENT_ID=test-slack, SLACK_CLIENT_SECRET=test-slack-secret,
// SLACK_SIGNING_SECRET=test-signing-secret, SLACK_API=http://localhost:8798
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/delegate-e2e.mjs dev.log
import { createServer } from "node:http";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const SIGNING = "test-signing-secret";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

// ---------- mock Slack ----------
const calls = [];
const mock = createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const p = Object.fromEntries(new URLSearchParams(body));
  const auth = req.headers.authorization ?? "";
  const method = req.url.slice(1);
  calls.push({ method, auth, p });
  const send = (o) => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (method === "oauth.v2.access") {
    if (p.client_id !== "test-slack" || p.client_secret !== "test-slack-secret" || p.code !== "good") return send({ ok: false, error: "invalid_code" });
    return send({ ok: true, access_token: "xoxb-bot-token", team: { id: "T1", name: "Acme" }, authed_user: { id: "U1", access_token: "xoxp-user-token", scope: "chat:write" } });
  }
  const isUser = auth === "Bearer xoxp-user-token", isBot = auth === "Bearer xoxb-bot-token";
  if (!isUser && !isBot) return send({ ok: false, error: "invalid_auth" });
  if (method === "conversations.list") return send({ ok: true, channels: [{ id: "C_GEN", name: "general" }, { id: "C_LAUNCH", name: "launch" }] });
  if (method === "users.lookupByEmail") return p.email === "bob@acme.dev" ? send({ ok: true, user: { id: "U2" } }) : send({ ok: false, error: "users_not_found" });
  if (method === "conversations.open") return send({ ok: true, channel: { id: `D_${p.users}` } });
  if (method === "chat.postMessage") return send({ ok: true, channel: p.channel, ts: String(Date.now() / 1000) });
  if (method === "chat.update") return send({ ok: true });
  send({ ok: false, error: "not_mocked" });
});
await new Promise((r) => mock.listen(8798, r));

// ---------- helpers ----------
async function call(token, method, path, body, extra = {}) {
  const res = await fetch(BASE + path, { method, redirect: "manual",
    headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && typeof body !== "string" ? { "content-type": "application/json" } : {}), ...extra },
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined });
  return { status: res.status, location: res.headers.get("location"), data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`))).join("\n").match(/sign-in code is (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
const slackClick = (actionId, value, user = "U1") => {
  const payload = JSON.stringify({ type: "block_actions", user: { id: user, team_id: "T1" }, team: { id: "T1" }, actions: [{ action_id: actionId, value }] });
  const body = new URLSearchParams({ payload }).toString();
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = "v0=" + createHmac("sha256", SIGNING).update(`v0:${ts}:${body}`).digest("hex");
  return { body, headers: { "content-type": "application/x-www-form-urlencoded", "X-Slack-Request-Timestamp": ts, "X-Slack-Signature": sig } };
};
const ask = (tok, action, payload) => call(tok, "POST", "/api/actions", { action, payload, agent: "claude-code" });
const waitFor = async (tok, id, pred, ms = 4000) => { const end = Date.now() + ms; let a; while (Date.now() < end) { a = (await call(tok, "GET", `/api/actions/${id}`)).data?.action; if (a && pred(a)) return a; await sleep(200); } return a; };

// ---------- tests ----------
const run = Date.now();
const alice = await signIn(`alice+${run}@acme.dev`);
const live = []; const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/live?token=${encodeURIComponent(alice)}`);
ws.onmessage = (m) => { try { live.push(JSON.parse(m.data)); } catch {} };
await new Promise((r) => (ws.onopen = r));

let d = (await call(alice, "GET", "/api/delegate")).data;
const rule = (k) => d.actions.find((a) => a.key === k)?.decision;
check("defaults: slack allow, internal email allow, external ask, spend deny", rule("slack.post") === "allow" && rule("email.internal") === "allow" && rule("email.external") === "ask" && rule("money.spend") === "deny");
check("slack available, not connected", d.connections.slack.available && !d.connections.slack.connected);

check("posting before connecting fails honestly", (await ask(alice, "slack.post", { to: "#launch", text: "hi" })).data?.action?.status === "failed");

const st = await call(alice, "GET", "/api/connectors/slack/start");
const au = st.location ? new URL(st.location) : null;
check("connect redirects to Slack with bot + user scopes", st.status === 302 && au?.host === "slack.com" && au.searchParams.get("user_scope")?.includes("chat:write") && au.searchParams.get("scope")?.includes("im:write"));
const state = au.searchParams.get("state");
check("tampered state rejected", (await call(alice, "GET", `/api/connectors/slack/callback?state=${state}x&code=good`)).status === 400);
const cb = await call(alice, "GET", `/api/connectors/slack/callback?state=${state}&code=good`);
check("callback stores the connection", cb.status === 302 && cb.location === "/app#/permissions?slack=connected");
d = (await call(alice, "GET", "/api/delegate")).data;
check("dashboard shows Slack connected to the workspace", d.connections.slack.connected && d.connections.slack.label === "Acme");
const stored = execFileSync("npx", ["wrangler", "d1", "execute", "anydock-v2", "--local", "--json", "--command", `select "accessToken","botToken" from "connection" where "externalId" = 'T1:U1' limit 1`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const row = JSON.parse(stored)[0].results[0];
check("tokens are encrypted at rest", row.accessToken.startsWith("v1.") && !stored.includes("xoxp-user-token") && !stored.includes("xoxb-bot-token"));
check("API never returns tokens", !JSON.stringify(d).includes("xox"));

const p1 = (await ask(alice, "slack.post", { to: "#launch", text: "Ranking is ready" })).data?.action;
const post1 = calls.findLast((c) => c.method === "chat.postMessage");
check("allowed post runs as the user in the right channel", p1?.status === "executed" && post1.auth === "Bearer xoxp-user-token" && post1.p.channel === "C_LAUNCH" && post1.p.text === "Ranking is ready");
const p2 = (await ask(alice, "slack.post", { to: "bob@acme.dev", text: "ping" })).data?.action;
check("post to a teammate's email becomes a DM", p2?.status === "executed" && calls.findLast((c) => c.method === "chat.postMessage").p.channel === "D_U2");
check("unknown channel fails with a clear reason", (await ask(alice, "slack.post", { to: "#nope", text: "x" })).data?.action?.result?.detail.includes("No Slack channel #nope"));

const e1 = (await ask(alice, "email", { to: "carol@acme.dev", subject: "Summary", body: "See work" })).data?.action;
check("same-domain email follows 'email teammates' (allow)", e1?.action === "email.internal" && e1.status === "executed");

const before = calls.length;
const e2r = await ask(alice, "email", { to: "someone@gmail.com", subject: "Hello", body: "Outside" });
const e2 = e2r.data?.action;
check("outside email needs approval (202 pending)", e2r.status === 202 && e2?.status === "pending" && e2.action === "email.external");
await sleep(800);
const dm = calls.slice(before).find((c) => c.method === "chat.postMessage" && c.auth === "Bearer xoxb-bot-token");
check("approval DM sent by the AnyDock bot with buttons", Boolean(dm) && dm.p.channel === "D_U1" && JSON.parse(dm.p.blocks).some((b) => b.type === "actions"));
check("dashboard gets a live action.new", live.some((e) => e.type === "action.new" && e.action.id === e2.id));

const bad = slackClick("approve", e2.id); bad.headers["X-Slack-Signature"] = "v0=deadbeef";
check("forged Slack click rejected", (await call(null, "POST", "/api/connectors/slack/interactions", bad.body, bad.headers)).status === 401);
const other = slackClick("approve", e2.id, "U999");
const ores = await call(null, "POST", "/api/connectors/slack/interactions", other.body, other.headers);
check("click from someone else's Slack does nothing", ores.data?.text?.includes("isn't connected") && (await waitFor(alice, e2.id, () => false, 600))?.status === "pending");
const ok = slackClick("approve", e2.id);
check("signed Slack click accepted", (await call(null, "POST", "/api/connectors/slack/interactions", ok.body, ok.headers)).status === 200);
const e2done = await waitFor(alice, e2.id, (a) => a.status !== "pending" && a.status !== "approved");
check("approved in Slack → executed", e2done?.status === "executed" && e2done.decidedVia === "slack", e2done?.status);
await sleep(300);
check("Slack approval message updated to a receipt", calls.some((c) => c.method === "chat.update" && c.auth === "Bearer xoxb-bot-token"));
check("second click is a no-op", (await call(null, "POST", "/api/connectors/slack/interactions", ok.body, ok.headers)).status === 200 && (await call(alice, "GET", `/api/actions/${e2.id}`)).data.action.status === "executed");

const e3 = (await ask(alice, "email", { to: "x@example.org", subject: "Hi", body: "b" })).data?.action;
const e3d = (await call(alice, "POST", `/api/actions/${e3.id}/decide`, { approve: false })).data?.action;
check("deny from the dashboard", e3d?.status === "denied" && e3d.decidedVia === "dashboard");

await call(alice, "PUT", "/api/delegate/policy", { action: "slack.post", decision: "deny" });
const blocked = await ask(alice, "slack.post", { to: "#launch", text: "should not post" });
check("rule set to deny → blocked (403), nothing posted", blocked.status === 403 && blocked.data?.action?.status === "blocked" && !calls.some((c) => c.p.text === "should not post"));
check("unknown rule value rejected", (await call(alice, "PUT", "/api/delegate/policy", { action: "slack.post", decision: "maybe" })).status === 400);
await call(alice, "PUT", "/api/delegate/policy", { action: "slack.post", decision: "ask" });
const asked = (await ask(alice, "slack.post", { to: "#launch", text: "needs ok" })).data?.action;
check("rule 'ask me' on Slack → pending", asked?.status === "pending");

const bob = await signIn(`bob+${run}@acme.dev`);
check("others can't see or decide your actions", (await call(bob, "GET", `/api/actions/${asked.id}`)).status === 404 && (await call(bob, "POST", `/api/actions/${asked.id}/decide`, { approve: true })).status === 404);

const logList = (await call(alice, "GET", "/api/actions")).data.actions;
check("activity log records everything", logList.length >= 8 && logList.some((a) => a.status === "blocked") && logList.some((a) => a.status === "denied"));

await call(alice, "DELETE", "/api/connectors/slack");
await call(alice, "PUT", "/api/delegate/policy", { action: "slack.post", decision: "allow" });
check("after disconnect, posting fails honestly", (await ask(alice, "slack.post", { to: "#launch", text: "x" })).data?.action?.result?.detail.includes("isn't connected"));

ws.close(); mock.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
