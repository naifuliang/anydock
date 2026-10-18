// End-to-end test of the CLI against a local server, using throwaway homes and synthetic transcripts.
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  node test/e2e.mjs ../server/dev.log
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SERVER = "http://localhost:8787";
const LOG = process.argv[2];
const CLI = new URL("../src/main.ts", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

// ---------- fixtures ----------
const root = mkdtempSync(join(tmpdir(), "anydock-e2e-"));
const env = {
  ...process.env,
  ANYDOCK_HOME: join(root, "home"),
  ANYDOCK_CLAUDE_ROOT: join(root, "claude", "projects"),
  ANYDOCK_CODEX_HOME: join(root, "codex"),
  ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1",
};
const projectDir = join(root, "work", "demo");
const claudeId = randomUUID();
const claudeFile = join(env.ANYDOCK_CLAUDE_ROOT, "-demo", `${claudeId}.jsonl`);
mkdirSync(join(env.ANYDOCK_CLAUDE_ROOT, "-demo"), { recursive: true });
const cl = (o) => JSON.stringify({ sessionId: claudeId, cwd: projectDir, gitBranch: "main", timestamp: new Date().toISOString(), ...o }) + "\n";
writeFileSync(
  claudeFile,
  JSON.stringify({ type: "custom-title", customTitle: "Sponsor research", sessionId: claudeId }) + "\n" +
    cl({ type: "user", message: { role: "user", content: "Research the hackathon sponsors" } }) +
    cl({ type: "user", isMeta: true, message: { role: "user", content: "<system-reminder>ignore me</system-reminder>" } }) +
    cl({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Looking up the event page." }, { type: "tool_use", id: "t1", name: "WebFetch", input: { url: "https://events.ycombinator.com" } }] } }) +
    cl({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "Sponsors: Primitive, Stripe. key sk-ant-api03-SECRETSECRETSECRET" }] } }),
);
const codexId = "01a1ffff-0000-7000-8000-00000000c0de";
const codexDir = join(env.ANYDOCK_CODEX_HOME, "sessions", "2026", "10", "17");
mkdirSync(codexDir, { recursive: true });
const codexFile = join(codexDir, `rollout-2026-10-17T10-00-00-${codexId}.jsonl`);
const cx = (type, payload) => JSON.stringify({ timestamp: new Date().toISOString(), type, payload }) + "\n";
writeFileSync(
  codexFile,
  cx("session_meta", { id: codexId, cwd: projectDir, timestamp: new Date().toISOString() }) +
    cx("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>x</environment_context>" }] }) +
    cx("response_item", { type: "message", role: "user", content: [{ type: "input_text", text: "Do what Nolan did for next month" }] }) +
    cx("response_item", { type: "function_call", name: "exec", call_id: "c1", arguments: "{\"cmd\":\"ls\"}" }) +
    cx("response_item", { type: "function_call_output", call_id: "c1", output: "README.md" }),
);
writeFileSync(join(env.ANYDOCK_CODEX_HOME, "session_index.jsonl"), JSON.stringify({ id: codexId, thread_name: "Next month's sponsors" }) + "\n");

const cli = (...args) => execFileSync("node", [CLI, ...args], { env, encoding: "utf8" });

// ---------- server helpers ----------
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

// ---------- tests ----------
const run = Date.now();
const nolanEmail = `nolan+${run}@example.com`;
const nolanBrowser = await signIn(nolanEmail); // the "browser" session that approves the CLI

const loginProc = spawn("node", [CLI, "login", "--no-browser"], { env });
let loginOut = "";
loginProc.stdout.on("data", (d) => (loginOut += d));
loginProc.stderr.on("data", (d) => (loginOut += d));
while (!/\b[A-Z0-9]{8}\b/.test(loginOut)) await sleep(100);
const userCode = loginOut.match(/^\s+([A-Z0-9]{8})\s*$/m)[1];
await call(nolanBrowser, "GET", `/api/auth/device?user_code=${userCode}`);
await call(nolanBrowser, "POST", "/api/auth/device/approve", { userCode });
await new Promise((r) => loginProc.on("exit", r));
check("device login via browser approval", loginOut.includes(`Signed in as ${nolanEmail}`));
check("whoami", cli("whoami").includes(nolanEmail));

const list = cli("sessions");
check("sessions lists both agents with titles", list.includes("Sponsor research") && list.includes("Next month's sponsors"));
check("nothing is authorized by default", !/^● (claude-code|codex)/m.test(list) && cli("rules").includes("Nothing is allowed"));

const synced = cli("sync", claudeId.slice(0, 8));
check("sync one session uploads it", /4 steps on server \(\+4\)/.test(synced), synced.trim().split("\n").pop());
// The CLI's token never sits in plain text: config.json has none, and the stored copy is encrypted.
const cfgJson = readFileSync(join(env.ANYDOCK_HOME, "config.json"), "utf8");
const tokenFile = readFileSync(join(env.ANYDOCK_HOME, "token.enc"), "utf8");
check("token is not stored in plain text", !JSON.parse(cfgJson).token && JSON.parse(cfgJson).tokenStore === "file" && !/"body":"[^"]*"/.test(cfgJson) && JSON.parse(tokenFile).v === 1);
const token = nolanBrowser; // same person, read through the web session
const mine = (await call(token, "GET", "/api/works")).data.works;
const work = mine.find((w) => w.sessionId === claudeId);
check("work exists with metadata", work?.title === "Sponsor research" && work.gitBranch === "main" && work.cwd === projectDir);
const steps = (await call(token, "GET", `/api/works/${work.id}/steps`)).data.steps;
check("meta/system-reminder lines dropped", steps.every((s) => !String(s.text ?? "").includes("ignore me")));
check("secrets redacted before upload", steps.some((s) => s.text?.includes("[REDACTED]")) && !JSON.stringify(steps).includes("SECRETSECRET"));
check("codex session not uploaded", !mine.some((w) => w.sessionId === codexId));
check("re-sync is a no-op", cli("sync", claudeId.slice(0, 8)).includes("(+0)"));

// Live: watcher running, agent keeps writing, a teammate shares something.
const bobEmail = `bob+${run}@example.com`;
const bob = await signIn(bobEmail);
await call(token, "POST", `/api/works/${work.id}/share`, { to: bobEmail });
const watcher = spawn("node", [CLI, "watch"], { env });
let watchOut = "";
watcher.stdout.on("data", (d) => (watchOut += d));
watcher.stderr.on("data", (d) => (watchOut += d));
await sleep(1500);
appendFileSync(claudeFile, cl({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Primitive's track pays the most cash." }] } }));
await sleep(3500);
check("watch uploads new steps live", /\+1 steps \(5 total\)/.test(watchOut));
const bobSees = (await call(bob, "GET", `/api/works/${work.id}/steps?from=4`)).data;
check("teammate sees the new step", bobSees.steps?.[0]?.text === "Primitive's track pays the most cash.");

const bobWork = (await call(bob, "PUT", "/api/works", { source: "codex", sessionId: `bob-${run}`, title: "Bob's notes" })).data.work;
await call(bob, "POST", `/api/works/${bobWork.id}/handover`, { to: nolanEmail, note: "Can you take this over?" });
await sleep(1500);
check("watch prints live inbox events", watchOut.includes(`handed over "Bob's notes": Can you take this over?`));

const dir = cli("sync", "--dir", projectDir);
check("sync --dir picks up the codex session too", dir.includes(codexId.slice(0, 8)) && dir.includes("Next month's sponsors"));
appendFileSync(codexFile, cx("response_item", { type: "message", role: "assistant", content: [{ type: "output_text", text: "Done." }] }));
await sleep(3500);
check("watch syncs codex appends via dir rule", /codex\s+01a1ffff.*\+1 steps/.test(watchOut));

watcher.kill();
cli("unsync", "--dir", projectDir);
cli("unsync", claudeId.slice(0, 8));
check("unsync removes rules", cli("rules").includes("Nothing is allowed"));
cli("logout");
let whoamiFailed = false;
try { cli("whoami"); } catch { whoamiFailed = true; }
check("logout forgets the token", whoamiFailed);

console.log(failures ? `\n${failures} FAILED\n--- watch output ---\n${watchOut}` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
