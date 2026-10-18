// End-to-end test of the one-line install: `curl …/install.sh | sh` → setup (browser sign-in, MCP, background service).
// Runs in a throwaway HOME against local wrangler dev. On macOS it registers a real launchd job and removes it after.
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  npm run build && node test/setup-e2e.mjs ../server/dev.log
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SERVER = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

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

const HOME = mkdtempSync(join(tmpdir(), "anydock-setup-"));
mkdirSync(join(HOME, ".codex"), { recursive: true }); // "Codex is installed"
// Minimal PATH, like a fresh shell: node is there, claude is not (so real Claude config is never touched).
const env = { HOME, SHELL: "/bin/zsh", PATH: `/usr/bin:/bin:${dirname(process.execPath)}`, ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1", ANYDOCK_NO_BROWSER: "1" };
const bin = join(HOME, ".anydock", "bin", "anydock");
const email = `newuser+${Date.now()}@example.com`;
const browser = await signIn(email); // the user's browser session

// The one line.
const proc = spawn("sh", ["-c", `curl -fsSL ${SERVER}/install.sh | sh`], { env });
let out = "";
proc.stdout.on("data", (d) => (out += d));
proc.stderr.on("data", (d) => (out += d));
const deadline = Date.now() + 30_000;
while (!/^\s+[A-Z0-9]{8}\s*$/m.test(out) && Date.now() < deadline) await sleep(100);
const userCode = out.match(/^\s+([A-Z0-9]{8})\s*$/m)?.[1];
check("installer reaches browser sign-in on its own", Boolean(userCode));
await call(browser, "GET", `/api/auth/device?user_code=${userCode}`);
await call(browser, "POST", "/api/auth/device/approve", { userCode });
const code = await new Promise((r) => proc.on("exit", r));
check("one line finishes successfully", code === 0, code ? out : "");
check("signed in", out.includes(`Signed in as ${email}`));
check("codex connected", readFileSync(join(HOME, ".codex", "config.toml"), "utf8").includes("[mcp_servers.anydock]"));
check("claude missing is handled", out.includes("Claude Code: not found"));
check("tells the user what to say next", out.includes("share this session with"));

if (process.platform === "darwin") {
  check("background sync running via launchd", out.includes("Background sync: running (launchd ai.anydock.watch"));
  await sleep(4000);
  const status = execFileSync(bin, ["service", "status"], { env, encoding: "utf8" });
  check("service status reports running", /running \(pid \d+\)/.test(status), status.trim());
  const log = existsSync(join(HOME, ".anydock", "watch.log")) ? readFileSync(join(HOME, ".anydock", "watch.log"), "utf8") : "";
  check("background watcher is up and signed in", log.includes("AnyDock is watching your agent sessions"), log.split("\n")[0]);
}

const again = execFileSync(bin, ["setup", "--no-browser"], { env, encoding: "utf8" });
check("re-running setup is idempotent", again.includes(`Already signed in as ${email}`) &&
  readFileSync(join(HOME, ".codex", "config.toml"), "utf8").match(/\[mcp_servers\.anydock\]/g).length === 1);

const un = execFileSync(bin, ["service", "uninstall"], { env, encoding: "utf8" });
check("service uninstall", un.includes("stopped and removed") && execFileSync(bin, ["service", "status"], { env, encoding: "utf8" }).includes("not installed"));

const noSetup = execFileSync("sh", ["-c", `curl -fsSL ${SERVER}/install.sh | ANYDOCK_NO_SETUP=1 sh`], { env, encoding: "utf8" });
check("ANYDOCK_NO_SETUP installs only (agent path)", noSetup.includes("Next: anydock setup") && !noSetup.includes("1/3"));

const agents = await (await fetch(`${SERVER}/agents.md`)).text();
check("agents.md is served", agents.startsWith("# Set up AnyDock") && agents.includes("ANYDOCK_NO_SETUP=1"));

console.log(failures ? `\n${failures} FAILED\n--- installer output ---\n${out}` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
