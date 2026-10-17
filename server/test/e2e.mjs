// End-to-end test of the Works API against local wrangler dev.
// Usage: npx wrangler dev > dev.log 2>&1 &  then  npm run test:e2e -- dev.log  (reads sign-in codes from the log)
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const run = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const idx = lines.findLastIndex((l) => l.includes(`to=${email}`));
  const otp = lines.slice(idx).join("\n").match(/sign-in code is (\d{6})/)[1];
  const r = await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp });
  return r.headers.get("set-auth-token");
}

function listen(token) {
  const events = [];
  const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/live?token=${encodeURIComponent(token)}`);
  ws.onmessage = (m) => events.push(JSON.parse(m.data));
  return new Promise((resolve, reject) => { ws.onopen = () => resolve({ ws, events }); ws.onerror = reject; });
}

const alice = await signIn(`alice+${run}@example.com`);
const bob = await signIn(`bob+${run}@example.com`);
check("sign in two users", Boolean(alice && bob));

const bobLive = await listen(bob);
await sleep(300);
check("bob live socket connected", bobLive.events.some((e) => e.type === "hello"));

const up = await call(alice, "PUT", "/api/works", { source: "claude-code", sessionId: `s-${run}`, title: "Sponsor research", cwd: "/tmp/demo" });
const workId = up.data?.work?.id;
check("alice upserts a work", up.status === 200 && up.data.work.visibility === "private" && up.data.work.role === "owner");
const again = await call(alice, "PUT", "/api/works", { source: "claude-code", sessionId: `s-${run}`, title: "Sponsor research v2" });
check("upsert is idempotent per session", again.data?.work?.id === workId && again.data.work.cwd === "/tmp/demo");

const s1 = await call(alice, "PUT", `/api/works/${workId}/steps`, { fromIndex: 0, steps: [{ role: "user", text: "a" }, { role: "assistant", text: "b" }, { role: "tool", text: "c" }] });
const s2 = await call(alice, "PUT", `/api/works/${workId}/steps`, { fromIndex: 2, steps: [{ role: "tool", text: "c" }, { role: "assistant", text: "d" }] });
check("append steps with overlap", s1.data?.stepCount === 3 && s2.data?.stepCount === 4);
const gap = await call(alice, "PUT", `/api/works/${workId}/steps`, { fromIndex: 10, steps: [{ text: "x" }] });
check("gap is rejected with current count", gap.status === 409 && gap.data.stepCount === 4);

check("bob cannot see unshared work", (await call(bob, "GET", `/api/works/${workId}`)).status === 404);

const sh = await call(alice, "POST", `/api/works/${workId}/share`, { to: `BOB+${run}@example.com`, note: "Here's how I picked the tracks" });
check("alice shares with bob (email case-insensitive)", sh.status === 201 && Boolean(sh.data.share.toUserId));
await sleep(500);
const inboxEvt = bobLive.events.find((e) => e.type === "inbox.new");
check("bob gets live inbox.new", inboxEvt?.item?.workTitle === "Sponsor research v2", inboxEvt ? `from=${inboxEvt.item.fromEmail}` : "");

const bobList = await call(bob, "GET", "/api/works");
check("bob's list includes it as shared", bobList.data?.works?.some((w) => w.id === workId && w.role === "shared"));
const bobSteps = await call(bob, "GET", `/api/works/${workId}/steps`);
check("bob reads the trajectory", bobSteps.data?.stepCount === 4 && bobSteps.data.steps[3].text === "d");
check("bob cannot upload steps", (await call(bob, "PUT", `/api/works/${workId}/steps`, { fromIndex: 4, steps: [{}] })).status === 403);

await call(alice, "PUT", `/api/works/${workId}/steps`, { fromIndex: 4, steps: [{ role: "assistant", text: "e" }] });
await sleep(500);
check("bob gets live work.updated", bobLive.events.some((e) => e.type === "work.updated" && e.workId === workId && e.stepCount === 5));

const carolEmail = `carol+${run}@example.com`;
const ho = await call(alice, "POST", `/api/works/${workId}/handover`, { to: carolEmail, note: "Over to you" });
check("handover to someone without an account", ho.status === 201 && ho.data.share.toUserId === null);
const carol = await signIn(carolEmail);
const carolList = await call(carol, "GET", "/api/works");
check("carol sees it as assignee after signing up", carolList.data?.works?.some((w) => w.id === workId && w.role === "assignee"));
const carolInbox = await call(carol, "GET", "/api/inbox?unread=1");
const ci = carolInbox.data?.items?.[0];
check("carol's inbox has the handover", ci?.kind === "handover" && ci.body === "Over to you");
await call(carol, "POST", `/api/inbox/${ci.id}/read`);
check("mark read", (await call(carol, "GET", "/api/inbox?unread=1")).data.items.length === 0);
check("carol (assignee) can share onward", (await call(carol, "POST", `/api/works/${workId}/share`, { to: `dave+${run}@example.com` })).status === 201);

check("bob cannot revoke", (await call(bob, "DELETE", `/api/shares/${sh.data.share.id}`)).status === 404);
await call(alice, "DELETE", `/api/shares/${sh.data.share.id}`);
check("after revoke bob loses access", (await call(bob, "GET", `/api/works/${workId}`)).status === 404);
check("unauthenticated is 401", (await call(null, "GET", "/api/works")).status === 401);

bobLive.ws.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
