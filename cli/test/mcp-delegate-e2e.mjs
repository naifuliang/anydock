// End-to-end test of the delegate MCP tools: anydock_email / anydock_slack_post / anydock_action_status,
// including in-session approval via MCP elicitation and waiting for an approval made elsewhere (the dashboard).
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  node test/mcp-delegate-e2e.mjs ../server/dev.log
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const SERVER = "http://localhost:8787";
const LOG = process.argv[2];
const CLI = new URL("../src/main.ts", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
// Agent email only goes out from a connected Gmail/Outlook (no platform fallback), so with no mailbox an approved send
// "fails closed". Either outcome proves the approval path ran.
const ran = (s) => s.startsWith("Done.") || s.includes("Connect Gmail or Outlook");

const root = mkdtempSync(join(tmpdir(), "anydock-mcpdel-"));
const env = { ...process.env, ANYDOCK_HOME: join(root, "home"), ANYDOCK_CLAUDE_ROOT: join(root, "claude"), ANYDOCK_CODEX_HOME: join(root, "codex"), ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1", CLAUDE_CODE_ENTRYPOINT: "cli", ANYDOCK_NO_BROWSER: "1" };
mkdirSync(env.ANYDOCK_CLAUDE_ROOT, { recursive: true });

async function call(token, method, path, body) {
  const res = await fetch(SERVER + path, { method, headers: { origin: SERVER, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => (l.includes(`to=${email}`) || l === `To: ${email}`))).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
async function cliLogin(email) {
  const browser = await signIn(email);
  const p = spawn("node", [CLI, "login", "--no-browser"], { env });
  let out = ""; p.stdout.on("data", (d) => (out += d));
  while (!/^\s+[A-Z0-9]{8}\s*$/m.test(out)) await sleep(100);
  const userCode = out.match(/^\s+([A-Z0-9]{8})\s*$/m)[1];
  await call(browser, "GET", `/api/auth/device?user_code=${userCode}`);
  await call(browser, "POST", "/api/auth/device/approve", { userCode });
  await new Promise((r) => p.on("exit", r));
  return browser;
}

// MCP client that can answer elicitation requests the way a human would.
function mcp({ elicitation, answer }) {
  const p = spawn("node", [CLI, "mcp"], { env, cwd: root });
  const pending = new Map(); let nextId = 1; const asked = [];
  createInterface({ input: p.stdout }).on("line", (l) => {
    const m = JSON.parse(l);
    if (m.method === "elicitation/create") { asked.push(m.params); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: m.id, result: answer() }) + "\n"); return; }
    pending.get(m.id)?.(m); pending.delete(m.id);
  });
  const request = (method, params) => new Promise((r) => { const id = nextId++; pending.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  return {
    asked,
    init: () => request("initialize", { protocolVersion: "2025-06-18", capabilities: elicitation ? { elicitation: {} } : {}, clientInfo: { name: "test", version: "0" } }),
    tool: async (name, args) => { const m = await request("tools/call", { name, arguments: args }); return m.result?.content?.[0]?.text ?? JSON.stringify(m.error); },
    list: async () => (await request("tools/list", {})).result.tools.map((t) => t.name),
    close: () => p.kill(),
  };
}

const run = Date.now();
const browser = await cliLogin(`dave+${run}@acme.dev`);
// The defaults ask every time; Dave chooses Allow for these two himself.
for (const k of ["slack.post", "email.internal"]) await call(browser, "PUT", "/api/delegate/policy", { action: k, decision: "allow" });

// Even a client that supports elicitation is never asked: an in-agent "Allow?" can't approve (the CLI's token is an
// agent token), so the tool waits for the person — dashboard here; Touch ID on a Mac; or Slack.
const a = mcp({ elicitation: true, answer: () => ({ action: "accept", content: { approve: true } }) });
await a.init();
const names = await a.list();
check("delegate tools are listed", ["anydock_slack_post", "anydock_email", "anydock_action_status"].every((n) => names.includes(n)));

const internal = await a.tool("anydock_email", { to: `erin+${run}@acme.dev`, subject: "Notes", body: "Here you go" });
check("same-domain email runs without asking", ran(internal) && a.asked.length === 0, internal);

const pendingId = async () => { for (let i = 0; i < 30; i++) { await sleep(300); const x = (await call(browser, "GET", "/api/actions?status=pending")).data.actions[0]; if (x) return x.id; } };
const ext = a.tool("anydock_email", { to: "partner@gmail.com", subject: "Intro", body: "Hi" });
const extId = await pendingId();
await call(browser, "POST", `/api/actions/${extId}/decide`, { approve: true });
const extText = await ext;
check("outside email waits for the person, not an in-agent prompt", a.asked.length === 0);
check("person approves in the dashboard → done", ran(extText), extText);
const acts = (await call(browser, "GET", "/api/actions")).data.actions;
check("decision recorded as made in the dashboard", acts.find((x) => x.summary.includes("partner@gmail.com"))?.decidedVia === "dashboard");

const decl = a.tool("anydock_email", { to: "other@gmail.com", subject: "Nope", body: "x" });
const declId = await pendingId();
await call(browser, "POST", `/api/actions/${declId}/decide`, { approve: false });
const declined = await decl;
check("person declines → denied", declined.includes("denied"), declined);

const slackOff = await a.tool("anydock_slack_post", { to: "#launch", text: "hello" });
check("Slack not connected is explained", slackOff.includes("isn't connected"), slackOff);
a.close();

// A client without elicitation: the tool waits while the user approves in the dashboard.
const b = mcp({ elicitation: false, answer: () => ({}) });
await b.init();
const waiting = b.tool("anydock_email", { to: "late@gmail.com", subject: "Later", body: "x" });
let id;
for (let i = 0; i < 30 && !id; i++) { await sleep(300); id = (await call(browser, "GET", "/api/actions?status=pending")).data.actions[0]?.id; }
await call(browser, "POST", `/api/actions/${id}/decide`, { approve: true });
const late = await waiting;
check("without elicitation, approval in the dashboard completes the tool call", ran(late), late);
check("anydock_action_status reports it", ran(await b.tool("anydock_action_status", { id })));

await call(browser, "PUT", "/api/delegate/policy", { action: "email.external", decision: "deny" });
const blocked = await b.tool("anydock_email", { to: "x@gmail.com", subject: "x", body: "x" });
check("rule deny → tool says blocked", blocked.includes("blocks this"), blocked);
b.close();

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
