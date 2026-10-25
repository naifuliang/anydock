// End-to-end test of "email as you" (Gmail, Outlook) and Inkbox texts, against local wrangler dev + one mock on :8797.
// Local dev must have (server/.dev.vars): GOOGLE_TOKEN_URL=http://localhost:8797/google/token, GMAIL_API=http://localhost:8797,
// MS_CLIENT_ID=test-ms, MS_CLIENT_SECRET=test-ms-secret, MS_LOGIN_URL=http://localhost:8797/ms, MS_GRAPH_API=http://localhost:8797,
// INKBOX_API_KEY=test-inkbox, INKBOX_IDENTITY_ID=ident-1, INKBOX_PHONE_NUMBER_ID=num-1, INKBOX_API=http://localhost:8797/inkbox
// (plus GOOGLE_CLIENT_ID/SECRET, which dev already has).  Usage: node test/mail-text-e2e.mjs dev.log
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
const jwt = (o) => ["e30", Buffer.from(JSON.stringify(o)).toString("base64url"), "sig"].join(".");

// ---------- mock Google + Microsoft + Inkbox ----------
const calls = [];
let msRefresh = "m-refresh";
const mock = createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const form = Object.fromEntries(new URLSearchParams(body));
  let json = null; try { json = JSON.parse(body); } catch {}
  const u = new URL(req.url, "http://x");
  calls.push({ method: req.method, path: u.pathname, query: Object.fromEntries(u.searchParams), headers: req.headers, form, json });
  const send = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (u.pathname === "/google/token") {
    if (form.grant_type === "authorization_code") return form.code === "g-good" ? send(200, { access_token: "g-access", refresh_token: "g-refresh", expires_in: 3600, id_token: jwt({ email: "alice.personal@gmail.com" }), scope: "gmail.send" }) : send(400, { error: "invalid_grant" });
    if (form.grant_type === "refresh_token") return form.refresh_token === "g-refresh" ? send(200, { access_token: "g-access-2", expires_in: 3600 }) : send(400, { error: "invalid_grant" });
  }
  if (u.pathname === "/gmail/v1/users/me/messages/send") return req.headers.authorization === "Bearer g-access-2" ? send(200, { id: "gm1" }) : send(401, { error: "bad token" });
  if (u.pathname === "/ms/common/oauth2/v2.0/token") {
    if (form.client_id !== "test-ms" || form.client_secret !== "test-ms-secret") return send(400, { error: "invalid_client" });
    if (form.grant_type === "authorization_code") return form.code === "m-good" ? send(200, { access_token: "m-access", refresh_token: msRefresh, expires_in: 3600 }) : send(400, { error: "invalid_grant" });
    if (form.grant_type === "refresh_token") {
      if (form.refresh_token !== msRefresh) return send(400, { error: "invalid_grant", error_description: "stale refresh token" });
      msRefresh = msRefresh + "-next"; // Microsoft rotates refresh tokens
      return send(200, { access_token: "m-access-2", refresh_token: msRefresh, expires_in: 3600 });
    }
  }
  if (u.pathname === "/v1.0/me") return send(200, { mail: "alice@contoso.com", userPrincipalName: "alice@contoso.com" });
  if (u.pathname === "/v1.0/me/sendMail") return req.headers.authorization === "Bearer m-access-2" ? (res.writeHead(202), res.end()) : send(401, { error: "bad token" });
  if (u.pathname === "/inkbox/imessage/messages") {
    if (req.headers["x-api-key"] !== "test-inkbox") return send(401, {});
    return json?.to === "+14155550999" ? send(409, { detail: "no conversation" }) : send(201, { message: { id: "im1", status: "pending" } });
  }
  if (u.pathname === "/inkbox/phone/numbers/num-1/texts") return req.headers["x-api-key"] === "test-inkbox" ? send(201, { id: "sms1", delivery_status: "queued" }) : send(401, {});
  send(404, { error: "not mocked", path: u.pathname });
});
await new Promise((r) => mock.listen(8797, r));

// ---------- helpers ----------
async function call(token, method, path, body) {
  const res = await fetch(BASE + path, { method, redirect: "manual", headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, location: res.headers.get("location"), data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => (l.includes(`to=${email}`) || l === `To: ${email}`))).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
const ask = (tok, action, payload) => call(tok, "POST", "/api/actions", { action, payload, agent: "codex" });
const last = (path) => calls.filter((c) => c.path === path).at(-1);

// ---------- tests ----------
const run = Date.now();
const aliceEmail = `alice+${run}@acme.dev`, bobEmail = `bob+${run}@acme.dev`;
const alice = await signIn(aliceEmail);
const bob = await signIn(bobEmail);
// The person chooses Allow for these (the defaults ask every time).
for (const k of ["slack.post", "email.internal"]) await call(alice, "PUT", "/api/delegate/policy", { action: k, decision: "allow" });
for (const k of ["slack.post", "email.internal"]) await call(bob, "PUT", "/api/delegate/policy", { action: k, decision: "allow" });

let d = (await call(alice, "GET", "/api/delegate")).data;
check("Gmail, Outlook and texting available, none connected", d.connections.gmail.available && d.connections.outlook.available && !d.connections.gmail.connected && d.connections.texting.available);
check("'Text a person' rule defaults to ask me", d.actions.find((a) => a.key === "phone.text")?.decision === "ask");

const gs = await call(alice, "GET", "/api/connectors/gmail/start");
const ga = new URL(gs.location);
check("Gmail connect asks only for gmail.send + offline", ga.host === "accounts.google.com" && ga.searchParams.get("scope").includes("gmail.send") && ga.searchParams.get("access_type") === "offline" && !ga.searchParams.get("scope").includes("readonly"));
check("Gmail callback rejects another user's state", (await call(bob, "GET", `/api/connectors/gmail/callback?state=${ga.searchParams.get("state")}&code=g-good`)).status === 400);
const gc = await call(alice, "GET", `/api/connectors/gmail/callback?state=${ga.searchParams.get("state")}&code=g-good`);
check("Gmail connected", gc.location === "/app#/permissions?gmail=connected");
d = (await call(alice, "GET", "/api/delegate")).data;
check("mailbox shows the connected address", d.connections.gmail.connected && d.connections.gmail.label === "alice.personal@gmail.com" && !JSON.stringify(d).includes("g-refresh"));

const e1 = (await ask(alice, "email", { to: bobEmail, subject: "Sponsor ranking ✓", body: "Primitive first." })).data.action;
const sent = last("/gmail/v1/users/me/messages/send");
const raw = sent ? Buffer.from(sent.json.raw, "base64url").toString("utf8") : "";
check("teammate email goes out from your Gmail", e1.status === "executed" && e1.result.detail.includes("from alice.personal@gmail.com"), e1.result?.detail);
check("Gmail message is well-formed (To, UTF-8 subject, body + footer)", raw.includes(`To: ${bobEmail}`) && raw.includes("Subject: =?UTF-8?B?") && Buffer.from(raw.split("\r\n\r\n")[1], "base64").toString().includes("— sent by my agent via AnyDock"));
check("access token minted from the stored refresh token", last("/google/token").form.grant_type === "refresh_token");

const os = await call(alice, "GET", "/api/connectors/outlook/start");
const oa = new URL(os.location);
check("Outlook connect asks for Mail.Send + offline_access", oa.origin + oa.pathname === "http://localhost:8797/ms/common/oauth2/v2.0/authorize" && oa.searchParams.get("scope").includes("Mail.Send") && oa.searchParams.get("scope").includes("offline_access"));
const oc = await call(alice, "GET", `/api/connectors/outlook/callback?state=${oa.searchParams.get("state")}&code=m-good`);
d = (await call(alice, "GET", "/api/delegate")).data;
check("Outlook connected with its address", oc.location === "/app#/permissions?outlook=connected" && d.connections.outlook.label === "alice@contoso.com");
const e2 = (await ask(alice, "email", { to: bobEmail, subject: "Via Outlook", body: "x" })).data.action;
const sm = last("/v1.0/me/sendMail");
check("most recently connected mailbox wins (Outlook)", e2.status === "executed" && e2.result.detail.includes("alice@contoso.com") && sm.json.message.toRecipients[0].emailAddress.address === bobEmail, e2.result?.detail);
const e3 = (await ask(alice, "email", { to: bobEmail, subject: "Again", body: "y" })).data.action;
check("rotated Microsoft refresh token is stored and reused", e3.status === "executed", e3.result?.detail);
await call(alice, "DELETE", "/api/connectors/outlook");
const e4 = (await ask(alice, "email", { to: bobEmail, subject: "Back to Gmail", body: "z" })).data.action;
check("after disconnecting Outlook, Gmail is used again", e4.result.detail.includes("alice.personal@gmail.com"), e4.result?.detail);
const ext = await ask(alice, "email", { to: "partner@example.org", subject: "Hi", body: "outside" });
check("outside email still asks first, even from your own mailbox", ext.status === 202 && ext.data.action.status === "pending");

const t1 = await ask(alice, "text", { to: "+14155550123", text: "Handover is in your inbox" });
check("texting asks first by default", t1.status === 202 && t1.data.action.action === "phone.text");
const t1d = (await call(alice, "POST", `/api/actions/${t1.data.action.id}/decide`, { approve: true })).data.action;
const im = last("/inkbox/imessage/messages");
check("approved text goes out as iMessage from AnyDock's identity", t1d.status === "executed" && im.query.agent_identity_id === "ident-1" && im.json.to === "+14155550123" && im.json.text.includes("(via AnyDock)") && Boolean(im.headers["idempotency-key"]), t1d.result?.detail);

await call(alice, "PUT", "/api/delegate/policy", { action: "phone.text", decision: "allow" });
const t2 = (await ask(alice, "text", { to: "+14155550999", text: "fallback please" })).data.action;
check("iMessage refused → falls back to SMS from the number", t2.status === "executed" && t2.result.channel === "sms" && last("/inkbox/phone/numbers/num-1/texts")?.json.to === "+14155550999", t2.result?.detail);
const t3 = (await ask(alice, "text", { to: bobEmail, text: "ping" })).data.action;
check("texting a teammate without a saved phone explains why", t3.status === "failed" && t3.result.detail.includes("No phone number"));
check("bad phone format rejected on profile", (await call(bob, "PUT", "/api/me/profile", { phone: "555-1234", textOnHandover: true })).status === 400);
await call(bob, "PUT", "/api/me/profile", { phone: "+14155550777", textOnHandover: true });
check("profile saved", (await call(bob, "GET", "/api/me/profile")).data.phone === "+14155550777");
const t4 = (await ask(alice, "text", { to: bobEmail, text: "ping again" })).data.action;
check("texting a teammate by email uses their saved phone", t4.status === "executed" && last("/inkbox/imessage/messages").json.to === "+14155550777");

const work = (await call(alice, "PUT", "/api/works", { source: "claude-code", sessionId: `t-${run}`, title: "Launch checklist" })).data.work;
const before = calls.filter((c) => c.path === "/inkbox/imessage/messages").length;
await call(alice, "POST", `/api/works/${work.id}/handover`, { to: bobEmail });
await sleep(700);
const alert = calls.filter((c) => c.path === "/inkbox/imessage/messages").slice(before)[0];
check("handover texts the recipient who opted in", alert?.json.to === "+14155550777" && alert.json.text.includes("handed you “Launch checklist”") && alert.json.text.includes(`/app#/w/${work.id}`));
const before2 = calls.filter((c) => c.path === "/inkbox/imessage/messages").length;
await call(alice, "POST", `/api/works/${work.id}/share`, { to: bobEmail });
await sleep(500);
check("a plain share doesn't text", calls.filter((c) => c.path === "/inkbox/imessage/messages").length === before2);

mock.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
