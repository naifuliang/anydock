// End-to-end test of `anydock mcp` over stdio: Nolan (in "Claude Code") shares and hands over his session,
// Jason (in "Codex") reads it and asks why. Throwaway homes + synthetic transcripts; never touches real config.
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  node test/mcp-e2e.mjs ../server/dev.log
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const SERVER = "http://localhost:8787";
const LOG = process.argv[2];
const CLI = new URL("../src/main.ts", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

const root = mkdtempSync(join(tmpdir(), "anydock-mcp-"));
const projectDir = join(root, "work", "hackathon");
mkdirSync(projectDir, { recursive: true });
mkdirSync(join(root, "elsewhere"), { recursive: true });
const homeFor = (name) => ({
  ...process.env,
  ANYDOCK_HOME: join(root, name, "anydock"),
  ANYDOCK_CLAUDE_ROOT: join(root, name, "claude", "projects"),
  ANYDOCK_CODEX_HOME: join(root, name, "codex"),
  ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1",
});
const nolanEnv = { ...homeFor("nolan"), CLAUDE_CODE_ENTRYPOINT: "cli" };
const jasonEnv = { ...homeFor("jason"), CODEX_THREAD: "1" };
for (const k of Object.keys(jasonEnv)) if (k.startsWith("CLAUDE_CODE_")) delete jasonEnv[k];

// Nolan's Claude Code session about picking a sponsor track.
const sid = randomUUID();
const dir = join(nolanEnv.ANYDOCK_CLAUDE_ROOT, "-hackathon");
mkdirSync(dir, { recursive: true });
const ev = (o) => JSON.stringify({ sessionId: sid, cwd: projectDir, gitBranch: "main", timestamp: new Date().toISOString(), ...o }) + "\n";
const say = (role, text) => ev({ type: role, message: { role, content: role === "user" ? text : [{ type: "text", text }] } });
writeFileSync(
  join(dir, `${sid}.jsonl`),
  JSON.stringify({ type: "custom-title", customTitle: "Pick our hackathon tracks", sessionId: sid }) + "\n" +
    say("user", "Survey the sponsors and pick which prize tracks we should target.") +
    ev({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: "w1", name: "WebFetch", input: { url: "https://events.ycombinator.com/MakeSomethingAgentsWant" } }] } }) +
    ev({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "w1", content: "Primitive: $3k/$2k/$1k cash. Blaxel: $1k." }] } }) +
    say("assistant", "We should target Primitive's track: it has the most cash ($3k first place) and fits agent communication.") +
    say("assistant", "Skip Blaxel for now: smaller prize and less fit with handover."),
);

const cli = (env, ...args) => execFileSync("node", [CLI, ...args], { env, encoding: "utf8" });

async function call(token, method, path, body) {
  const res = await fetch(SERVER + path, {
    method,
    headers: { origin: SERVER, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => (l.includes(`to=${email}`) || l === `To: ${email}`))).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
async function cliLogin(env, email) {
  const browser = await signIn(email);
  const p = spawn("node", [CLI, "login", "--no-browser"], { env });
  let out = "";
  p.stdout.on("data", (d) => (out += d));
  while (!/^\s+[A-Z0-9]{8}\s*$/m.test(out)) await sleep(100);
  const userCode = out.match(/^\s+([A-Z0-9]{8})\s*$/m)[1];
  await call(browser, "GET", `/api/auth/device?user_code=${userCode}`);
  await call(browser, "POST", "/api/auth/device/approve", { userCode });
  await new Promise((r) => p.on("exit", r));
  return out.includes("Signed in");
}

// Minimal MCP client over stdio.
function mcp(env, cwd) {
  const p = spawn("node", [CLI, "mcp"], { env, cwd });
  const pending = new Map();
  let nextId = 1;
  createInterface({ input: p.stdout }).on("line", (l) => {
    const m = JSON.parse(l);
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  const request = (method, params) => new Promise((r) => { const id = nextId++; pending.set(id, r); p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); });
  return {
    request,
    async tool(name, args) {
      const m = await request("tools/call", { name, arguments: args });
      return { text: m.result?.content?.[0]?.text ?? JSON.stringify(m.error), isError: Boolean(m.result?.isError || m.error) };
    },
    close: () => p.kill(),
  };
}

// ---------- tests ----------
const run = Date.now();
const nolanEmail = `nolan+${run}@example.com`;
const jasonEmail = `jason+${run}@example.com`;

const loggedOut = mcp(nolanEnv, projectDir);
await loggedOut.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
const lo = await loggedOut.tool("anydock_inbox", {});
check("signed-out tool call explains how to log in", lo.isError && lo.text.includes("anydock login"));
loggedOut.close();

check("both CLIs sign in", (await cliLogin(nolanEnv, nolanEmail)) && (await cliLogin(jasonEnv, jasonEmail)));

const nolan = mcp(nolanEnv, projectDir);
const init = await nolan.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "x" } });
check("initialize", init.result?.serverInfo?.name === "anydock" && init.result.protocolVersion === "2025-06-18" && Boolean(init.result.capabilities.tools));
const list = await nolan.request("tools/list", {});
const names = list.result.tools.map((t) => t.name);
check("tools/list has the six tools", ["anydock_share", "anydock_handover", "anydock_inbox", "anydock_list_works", "anydock_read_work", "anydock_ask_why"].every((n) => names.includes(n)));
check("unknown method errors", (await nolan.request("nope/nope", {})).error?.code === -32601);

const shared = await nolan.tool("anydock_share", { to: jasonEmail, note: "Here's how we picked tracks" });
check("share detects the current session from cwd", !shared.isError && shared.text.includes(`Shared "Pick our hackathon tracks"`) && shared.text.includes(sid.slice(0, 8)), shared.isError ? shared.text : "");
check("sharing also authorized the session to sync", cli(nolanEnv, "rules").includes(sid));

const jason = mcp(jasonEnv, join(root, "elsewhere"));
await jason.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "codex", version: "x" } });
const inbox = await jason.tool("anydock_inbox", {});
const workId = inbox.text.match(/work ([0-9a-f-]{36})/)?.[1];
check("jason's inbox shows the share with note", inbox.text.includes("[new] Shared from") && inbox.text.includes("Here's how we picked tracks") && Boolean(workId));

const read = await jason.tool("anydock_read_work", { work_id: workId });
check("read_work returns numbered trajectory with owner", read.text.includes(`by ${nolanEmail}`) && read.text.includes("[0] user: Survey the sponsors") && read.text.includes("assistant → WebFetch"));
const textOnly = await jason.tool("anydock_read_work", { work_id: workId, include_tools: false });
check("read_work can hide tool steps", !textOnly.text.includes("WebFetch"));
const paged = await jason.tool("anydock_read_work", { work_id: workId, from: 0, limit: 2 });
check("read_work pages", paged.text.includes("call again with from=2"));

const why = await jason.tool("anydock_ask_why", { work_id: workId, question: "Why did you pick Primitive's track over Blaxel?" });
check("ask_why surfaces the decision with step numbers", why.text.includes("[3] assistant: We should target Primitive's track") && why.text.includes("Original goal:"));
check("ask_why includes context around hits", why.text.includes("Skip Blaxel"));

const handed = await nolan.tool("anydock_handover", { to: jasonEmail, note: "Take it from here" });
check("handover", !handed.isError && handed.text.startsWith("Handed over"));
const inbox2 = await jason.tool("anydock_inbox", { unread_only: true });
check("handover arrives in jason's inbox", inbox2.text.includes("Handover from") && inbox2.text.includes("Take it from here"));
const works = await jason.tool("anydock_list_works", {});
check("jason now has it as assignee", works.text.includes("Pick our hackathon tracks") && works.text.includes("assignee"));

const missing = await jason.tool("anydock_read_work", { work_id: "00000000-0000-0000-0000-000000000000" });
check("unknown work is a clean error", missing.isError && missing.text.includes("Not found"));
const noSession = await jason.tool("anydock_share", { to: nolanEmail });
check("no session in cwd is a clean error", noSession.isError && noSession.text.includes("Couldn't find an active codex session"));

nolan.close();
jason.close();

// install / uninstall touch only the throwaway Codex home; claude is hidden from PATH so real Claude config is untouched.
const noClaudeEnv = { ...nolanEnv, PATH: "/usr/bin:/bin" };
const skipped = execFileSync(process.execPath, [CLI, "mcp", "install"], { env: noClaudeEnv, encoding: "utf8" });
check("install skips Codex when it isn't installed", skipped.includes("Codex: not found"));
mkdirSync(nolanEnv.ANYDOCK_CODEX_HOME, { recursive: true });
const nodeBin = process.execPath;
const inst = execFileSync(nodeBin, [CLI, "mcp", "install"], { env: noClaudeEnv, encoding: "utf8" });
const toml = readFileSync(join(nolanEnv.ANYDOCK_CODEX_HOME, "config.toml"), "utf8");
check("install writes the Codex MCP block", inst.includes("Claude Code: not found") && toml.includes("[mcp_servers.anydock]") && toml.includes('"mcp"]'));
execFileSync(nodeBin, [CLI, "mcp", "install"], { env: noClaudeEnv, encoding: "utf8" });
check("install is idempotent", readFileSync(join(nolanEnv.ANYDOCK_CODEX_HOME, "config.toml"), "utf8").match(/\[mcp_servers\.anydock\]/g).length === 1);
execFileSync(nodeBin, [CLI, "mcp", "uninstall"], { env: noClaudeEnv, encoding: "utf8" });
check("uninstall removes it", !readFileSync(join(nolanEnv.ANYDOCK_CODEX_HOME, "config.toml"), "utf8").includes("anydock"));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
