// Self-update while running: an older MCP server, with a newer build published, upgrades itself in place — same stdio
// session, no agent restart — tells the client to re-list tools, and keeps answering. Also: `anydock update`.
// Builds the bundle twice (older → installed in a temp home, newer → served by local wrangler dev from public/cli/).
// Usage: (cd ../server && npx wrangler dev > dev.log 2>&1 &)  then  node test/update-e2e.mjs
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SERVER = "http://localhost:8787";
const CLI_DIR = new URL("..", import.meta.url).pathname;
const BUNDLE = new URL("../../server/public/cli/anydock.mjs", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
const build = () => execFileSync("npm", ["run", "build"], { cwd: CLI_DIR, encoding: "utf8" });

const root = mkdtempSync(join(tmpdir(), "anydock-update-"));
const home = join(root, ".anydock");
mkdirSync(join(home, "bin"), { recursive: true });
const installed = join(home, "bin", "anydock.mjs");
const env = { ...process.env, HOME: root, ANYDOCK_HOME: home, ANYDOCK_SERVER: SERVER, ANYDOCK_NO_NATIVE_APPROVAL: "1", ANYDOCK_NO_BROWSER: "1" };

build();
copyFileSync(BUNDLE, installed);
const oldVersion = execFileSync(process.execPath, [installed, "version"], { env, encoding: "utf8" }).trim();
await sleep(1100); // builds are numbered by the second
build();
await sleep(3000); // wrangler dev picks up the new static files
const served = JSON.parse(await (await fetch(`${SERVER}/cli/version.json`, { cache: "no-store" })).text());
check("a newer build is published", served.version !== oldVersion, `${oldVersion} → ${served.version}`);

// ---------- the MCP server upgrades itself in place ----------
const mcp = spawn(process.execPath, [installed, "mcp"], { env, cwd: root });
let buf = "", err = "";
const msgs = [];
mcp.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) msgs.push(JSON.parse(l)); } });
mcp.stderr.on("data", (d) => (err += d));
const rpc = async (id, method, params) => { mcp.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"); for (let i = 0; i < 100; i++) { const m = msgs.find((x) => x.id === id); if (m) return m; await sleep(100); } return null; };
const init = await rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {} });
check("the old server starts and declares tools.listChanged", init?.result?.serverInfo?.version === oldVersion && init.result.capabilities.tools.listChanged === true, init?.result?.serverInfo?.version);
for (let i = 0; i < 150 && !msgs.some((m) => m.method === "notifications/tools/list_changed"); i++) await sleep(100);
check("it finds the new version and reloads in place (same process, same pipes)", err.includes(`AnyDock MCP reloaded: ${oldVersion} → ${served.version}`), err.trim().split("\n").pop());
check("…then tells the client to re-list tools", msgs.some((m) => m.method === "notifications/tools/list_changed"));
const list = await rpc(2, "tools/list", {});
check("the same session keeps working on the new code", Array.isArray(list?.result?.tools) && list.result.tools.some((t) => t.name === "anydock_permissions"));
check("the file on disk is the new build", execFileSync(process.execPath, [installed, "version"], { env, encoding: "utf8" }).trim() === served.version);
mcp.kill();

// ---------- anydock update ----------
copyFileSync(BUNDLE, join(home, "bin", "fresh.mjs"));
const upToDate = execFileSync(process.execPath, [join(home, "bin", "fresh.mjs"), "update"], { env, encoding: "utf8" });
check("anydock update on the newest build says so", upToDate.includes("is up to date"));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
