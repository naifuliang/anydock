// Artifacts from the agent side, against a local server: the CLI (`anydock artifact …`, `anydock open`) and the MCP tools
// (`anydock_artifact_*`) — same core. Skeleton → fill, session → Work link, uploads (app folder, Office file, Markdown),
// share, and the skill that `anydock mcp install` writes. Throwaway homes only.
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  node test/artifacts-e2e.mjs ../server/dev.log
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const SERVER = "http://localhost:8787";
const LOG = process.argv[2];
const CLI = new URL("../src/main.ts", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

const root = mkdtempSync(join(tmpdir(), "anydock-art-"));
const projectDir = join(root, "work", "demo");
mkdirSync(projectDir, { recursive: true });
const env = {
  ...process.env, HOME: join(root, "home"), ANYDOCK_HOME: join(root, "home", ".anydock"), ANYDOCK_CLAUDE_ROOT: join(root, "claude", "projects"),
  ANYDOCK_CODEX_HOME: join(root, "home", ".codex"), ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1", ANYDOCK_NO_BROWSER: "1",
  CLAUDE_CODE_ENTRYPOINT: "cli", // as if Claude Code ran these commands
};
mkdirSync(join(env.HOME, ".claude"), { recursive: true });
mkdirSync(env.ANYDOCK_CODEX_HOME, { recursive: true });
// A Claude Code session in projectDir, so artifacts made "in it" can join its Work.
const sessionId = randomUUID();
mkdirSync(join(env.ANYDOCK_CLAUDE_ROOT, "-demo"), { recursive: true });
writeFileSync(join(env.ANYDOCK_CLAUDE_ROOT, "-demo", `${sessionId}.jsonl`),
  JSON.stringify({ type: "user", sessionId, cwd: projectDir, timestamp: new Date().toISOString(), message: { role: "user", content: "Write the launch plan" } }) + "\n");

const cli = (...args) => execFileSync(process.execPath, [CLI, ...args], { env, cwd: projectDir, encoding: "utf8" });
const cliIn = (input, ...args) => execFileSync(process.execPath, [CLI, ...args], { env, cwd: projectDir, encoding: "utf8", input });
async function call(token, method, path, body) {
  const res = await fetch(SERVER + path, { method, headers: { origin: SERVER, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`) || l === `To: ${email}`)).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}

// ---------- sign in the CLI (device flow, approved in "the browser") ----------
const run = Date.now();
const email = `nolan+${run}@acme.dev`, bobEmail = `bob+${run}@acme.dev`;
const browser = await signIn(email);
const bob = await signIn(bobEmail);
const login = spawn(process.execPath, [CLI, "login", "--no-browser"], { env, cwd: projectDir });
let out = "";
login.stdout.on("data", (d) => (out += d));
while (!/^\s+[A-Z0-9]{8}\s*$/m.test(out)) await sleep(100);
const userCode = out.match(/^\s+([A-Z0-9]{8})\s*$/m)[1];
await call(browser, "GET", `/api/auth/device?user_code=${userCode}`);
await call(browser, "POST", "/api/auth/device/approve", { userCode });
await new Promise((r) => login.on("exit", r));
check("CLI signed in", out.includes("Signed in as"));

// ---------- CLI: skeleton → fill ----------
const created = cli("artifact", "create", "Launch plan", "--type", "doc", "--outline", "# Launch plan: one-line goal|Timeline: key dates|Risks");
const id = created.match(/id: ([0-9a-f-]{36})/)?.[1];
check("artifact create lays down a skeleton and says how to show and fill it", Boolean(id) && created.includes("3 still to write") && created.includes(`anydock open ${id}`) && created.includes("built-in browser"), created.split("\n")[0]);
const w1 = cli("artifact", "write", id.slice(0, 8), "Timeline", "--content", "- Oct 18: demo\n- Oct 25: beta");
check("write a section by heading (id prefix works)", w1.includes('Wrote "Timeline"') && w1.includes("Still to write: Launch plan, Risks"), w1.trim());
const w2 = cliIn("Ship the demo, then the beta.", "artifact", "write", id, "1", "-");
check("write a section by number from stdin", w2.includes('Wrote "Launch plan"'), w2.trim());
const w3 = cli("artifact", "write", id, "new", "--heading", "Owners", "--after", "Timeline", "--content", "Nolan, Jason");
check("add a section after another", w3.includes('Added section "Owners"'));
const read = cli("artifact", "read", id);
check("read shows sections in order with status", read.includes("Sections: 1. Launch plan · 2. Timeline · 3. Owners · 4. Risks [todo]") && read.includes("- Oct 18: demo"), read.split("\n").slice(0, 3).join(" | "));

// The artifact belongs to this Claude Code session; once the session syncs, it's part of that Work.
cli("sync", sessionId.slice(0, 8));
const art = (await call(browser, "GET", `/api/artifacts/${id}`)).data;
check("made inside a session → joins its Work when that syncs", Boolean(art.work) && art.artifact.sessionId === sessionId, JSON.stringify(art.work));

// ---------- uploads ----------
const appDir = join(root, "app");
mkdirSync(join(appDir, "assets"), { recursive: true });
writeFileSync(join(appDir, "index.html"), "<link rel=stylesheet href=assets/s.css><h1>Hi</h1>");
writeFileSync(join(appDir, "assets", "s.css"), "h1{color:red}");
const up = cli("artifact", "upload", appDir, "--title", "Mini app");
const appId = up.match(/id: ([0-9a-f-]{36})/)?.[1];
const appUrl = up.match(/It runs at (\S+)/)?.[1];
check("upload a folder → a running app", Boolean(appId) && up.includes("2 file(s)") && Boolean(appUrl));
const css = await fetch(appUrl + "assets/s.css");
check("its assets are served with the right type", css.status === 200 && css.headers.get("content-type").startsWith("text/css"));
writeFileSync(join(appDir, "index.html"), "<h1>Hi v2</h1>");
const up2 = cli("artifact", "upload", appDir, "--id", appId);
check("upload again with --id → new version", up2.includes("as version 2"));

const docx = join(root, "Memo.docx");
writeFileSync(docx, Buffer.from([80, 75, 3, 4, 9, 9, 9, 9]));
const upFile = cli("artifact", "upload", docx);
const fileId = upFile.match(/id: ([0-9a-f-]{36})/)?.[1];
const fileMeta = (await call(browser, "GET", `/api/artifacts/${fileId}`)).data;
check("upload an Office file → kept as a versioned file", fileMeta.artifact.kind === "file" && fileMeta.artifact.format === "docx" && fileMeta.files[0].contentType.includes("wordprocessingml"));
const md = join(root, "notes.md");
writeFileSync(md, "# Notes\n\nIntro\n\n## Decisions\n\nUse AnyDock.");
const upMd = cli("artifact", "upload", md);
check("upload Markdown → a live, sectioned doc", upMd.includes('Created doc "notes"'));

// ---------- share / list / open ----------
check("share with a teammate", cli("artifact", "share", id, bobEmail).includes(`Shared with ${bobEmail}`));
check("they can open it", (await call(bob, "GET", `/api/artifacts/${id}`)).data?.artifact?.access === "edit");
check("list shows them", cli("artifact", "list").includes("Launch plan"));
check("open falls back to the browser without the Mac window", cli("open", id.slice(0, 8)).includes(`/a/${id}`));
const link = cli("open", id.slice(0, 8), "--link").trim();
check("create output carries a one-time sign-in link for a built-in browser", /\/l\/[^ ]+\?next=%2Fa%2F/.test(created) && created.includes("bring the browser panel to the front"));
const signed = await fetch(link, { redirect: "manual" });
check("open --link prints a working one-time link to the artifact", signed.status === 302 && signed.headers.get("location") === `/a/${id}` && signed.headers.getSetCookie().length > 0, link);

// ---------- MCP: same features ----------
const mcp = spawn(process.execPath, [CLI, "mcp"], { env, cwd: projectDir });
let buf = "";
const pending = new Map();
mcp.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (!line.trim()) continue; const m = JSON.parse(line); pending.get(m.id)?.(m); } });
let seq = 0;
const rpc = (method, params) => new Promise((r) => { const idn = ++seq; pending.set(idn, r); mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: idn, method, params }) + "\n"); });
const tool = async (name, args) => (await rpc("tools/call", { name, arguments: args })).result.content[0].text;
await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
const names = (await rpc("tools/list", {})).result.tools.map((t) => t.name);
check("MCP lists the artifact tools", ["anydock_artifact_create", "anydock_artifact_write", "anydock_artifact_read", "anydock_artifact_upload", "anydock_artifact_list", "anydock_artifact_share", "anydock_artifact_open"].every((n) => names.includes(n)));
const mc = await tool("anydock_artifact_create", { title: "Pitch", type: "slides", outline: ["AnyDock: tagline", "Problem", "Demo"] });
const deckId = mc.match(/id: ([0-9a-f-]{36})/)?.[1];
check("MCP creates a deck skeleton", Boolean(deckId) && mc.includes("3 still to write"));
const mw = await tool("anydock_artifact_write", { id: deckId, section: "Problem", content: "- Humans are the glue" });
check("MCP fills a slide", mw.includes('Wrote "Problem"'));
const sheet = await tool("anydock_artifact_create", { title: "Budget", type: "sheet", content: "Item,Cost\nCredits,100" });
const sheetId = sheet.match(/id: ([0-9a-f-]{36})/)?.[1];
await tool("anydock_artifact_write", { id: sheetId, content: "Item,Cost\nCredits,100\nDomain,70\nTotal,=SUM(B2:B3)" });
check("MCP writes a sheet as CSV and reads it back", (await tool("anydock_artifact_read", { id: sheetId })).includes("Total,=SUM(B2:B3)"));
const mr = await tool("anydock_artifact_read", { id: "Launch plan" });
check("MCP reads by exact title", mr.includes("Ship the demo"));
mcp.kill();

// ---------- skill ----------
const claudeSkill = join(env.HOME, ".claude", "skills", "anydock", "SKILL.md"), codexSkill = join(env.ANYDOCK_CODEX_HOME, "skills", "anydock", "SKILL.md");
const inst = execFileSync(process.execPath, [CLI, "mcp", "install"], { env: { ...env, PATH: "/usr/bin:/bin" }, cwd: projectDir, encoding: "utf8" });
check("mcp install also installs the skill for Claude Code and Codex", inst.includes("Skill: added the AnyDock skill to Claude Code and Codex") && existsSync(claudeSkill) && existsSync(codexSkill));
const sk = readFileSync(claudeSkill, "utf8");
check("the skill teaches skeleton-first, the built-in browser, and both MCP and CLI", sk.startsWith("---\nname: anydock") && sk.includes("Skeleton first") && sk.includes("built-in browser") && sk.includes("anydock_artifact_write") && sk.includes("artifact write"));
execFileSync(process.execPath, [CLI, "mcp", "uninstall"], { env: { ...env, PATH: "/usr/bin:/bin" }, cwd: projectDir, encoding: "utf8" });
check("mcp uninstall removes it", !existsSync(claudeSkill) && !existsSync(codexSkill));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
