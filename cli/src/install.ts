import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Registers `anydock mcp` with Claude Code (user scope) and Codex (~/.codex/config.toml).
const NODE = process.execPath;
const ENTRY = fileURLToPath(new URL("./main.ts", import.meta.url));
const CODEX_CONFIG = join(process.env.ANYDOCK_CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");
const CODEX_BLOCK = /\n?\[mcp_servers\.anydock\]\n(?:(?!\[)[^\n]*\n?)*/;

function claude(args: string[]) {
  return spawnSync("claude", args, { encoding: "utf8" });
}

export function installMcp(): void {
  // Claude Code
  const probe = claude(["--version"]);
  if (probe.error) {
    console.log(`Claude Code: not found. Add manually: claude mcp add --scope user anydock -- "${NODE}" "${ENTRY}" mcp`);
  } else {
    claude(["mcp", "remove", "--scope", "user", "anydock"]); // replace any older registration
    const r = claude(["mcp", "add", "--scope", "user", "anydock", "--", NODE, ENTRY, "mcp"]);
    console.log(r.status === 0 ? "Claude Code: added AnyDock MCP (user scope)." : `Claude Code: failed — ${r.stderr.trim()}`);
  }

  // Codex
  if (!existsSync(dirname(CODEX_CONFIG))) {
    console.log("Codex: not found (no ~/.codex). Skipped.");
    console.log("Restart Claude Code sessions to load it.");
    return;
  }
  const block = `[mcp_servers.anydock]\ncommand = ${JSON.stringify(NODE)}\nargs = [${JSON.stringify(ENTRY)}, "mcp"]\n`;
  const current = existsSync(CODEX_CONFIG) ? readFileSync(CODEX_CONFIG, "utf8") : "";
  const without = current.replace(CODEX_BLOCK, "\n");
  writeFileSync(CODEX_CONFIG, `${without.replace(/\n*$/, "\n")}\n${block}`);
  console.log(`Codex: added AnyDock MCP to ${CODEX_CONFIG.replace(homedir(), "~")}.`);
  console.log("Restart Claude Code / Codex sessions to load it.");
}

export function uninstallMcp(): void {
  const r = claude(["mcp", "remove", "--scope", "user", "anydock"]);
  console.log(r.error ? "Claude Code: not found." : r.status === 0 ? "Claude Code: removed AnyDock MCP." : "Claude Code: AnyDock MCP wasn't installed.");
  if (existsSync(CODEX_CONFIG)) {
    const current = readFileSync(CODEX_CONFIG, "utf8");
    const next = current.replace(CODEX_BLOCK, "\n");
    if (next !== current) writeFileSync(CODEX_CONFIG, next);
    console.log(next !== current ? "Codex: removed AnyDock MCP." : "Codex: AnyDock MCP wasn't installed.");
  }
}
