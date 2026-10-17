#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { api, requireLogin } from "./api.ts";
import { isAuthorized, loadState, saveState, type SyncRule } from "./config.ts";
import { installMcp, uninstallMcp } from "./install.ts";
import { login, logout } from "./login.ts";
import { serveMcp } from "./mcp.ts";
import { installService, serviceStatus, uninstallService } from "./service.ts";
import { setup } from "./setup.ts";
import { findSession, listSessionFiles, parseSession } from "./sources/discover.ts";
import { syncSession, watchAndSync } from "./sync.ts";
import { selfUpdate, startAutoUpdate, updateInBackground } from "./update.ts";
import { VERSION } from "./version.ts";

const HELP = `anydock — share and hand over agent work

Usage:
  anydock setup [--no-browser] [--no-service]   Sign in, connect Claude Code + Codex, start background sync
  anydock login [--server URL] [--no-browser]   Sign in (opens the browser)
  anydock logout                                Forget the saved token
  anydock whoami                                Show who you are signed in as
  anydock sessions [--limit N] [--all]          List local Claude Code and Codex sessions
  anydock sync <session-id>                     Allow one session to sync, and upload it now
  anydock sync --dir [path]                     Allow every session under a folder (default: here)
  anydock unsync <session-id> | --dir [path]    Stop syncing
  anydock rules                                 Show what is allowed to sync
  anydock watch                                 Keep allowed sessions in sync live
  anydock mcp install | uninstall               Add AnyDock tools to Claude Code and Codex
  anydock mcp                                   Run the MCP server (agents launch this)
  anydock service install | uninstall | status  Background sync at login (launchd / systemd)
  anydock update                                Update to the latest version
  anydock version                               Show the installed version

Nothing leaves this machine unless you allowed it with "anydock sync".`;

const tilde = (p?: string) => (p ? p.replace(homedir(), "~") : "");
const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      server: { type: "string" },
      "no-browser": { type: "boolean" },
      "no-service": { type: "boolean" },
      limit: { type: "string" },
      all: { type: "boolean" },
      dir: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [cmd, arg] = positionals;

  switch (values.help ? "help" : cmd) {
    case "setup":
      return setup({ openBrowser: !values["no-browser"], service: !values["no-service"] });

    case "service":
      if (arg === "install") return console.log(installService());
      if (arg === "uninstall") return console.log(uninstallService());
      return console.log(serviceStatus());

    case "login":
      return login({ server: values.server, openBrowser: !values["no-browser"] });

    case "logout":
      return logout();

    case "whoami": {
      const cfg = requireLogin();
      const { user } = await api("GET", "/api/me", undefined, cfg);
      console.log(`${user.email} (${cfg.server})`);
      return;
    }

    case "sessions": {
      const state = loadState();
      const files = listSessionFiles();
      const limit = values.all ? files.length : Number(values.limit ?? 20);
      const rows = files.slice(0, limit).map((f) => ({ f, s: parseSession(f) }));
      if (rows.length === 0) return console.log("No Claude Code or Codex sessions found on this machine.");
      for (const { f, s } of rows) {
        const mark = isAuthorized(state, s) ? "●" : " ";
        console.log(
          `${mark} ${s.source.padEnd(11)} ${s.sessionId.slice(0, 8)}  ${ago(f.mtimeMs).padStart(4)}  ${String(s.steps.length).padStart(5)} steps  ${s.title.slice(0, 60)}  ${tilde(s.cwd)}`,
        );
      }
      console.log(`\n● = allowed to sync. ${files.length > limit ? `Showing ${limit} of ${files.length}; use --all.` : ""}`);
      return;
    }

    case "sync":
    case "unsync": {
      const state = loadState();
      let rule: SyncRule;
      let label: string;
      if (values.dir) {
        const path = resolve(arg ?? process.cwd());
        rule = { kind: "dir", path };
        label = `sessions under ${tilde(path)}`;
      } else {
        if (!arg) throw new Error(`Usage: anydock ${cmd} <session-id> | --dir [path]`);
        const s = findSession(listSessionFiles(), arg);
        rule = { kind: "session", source: s.source, sessionId: s.sessionId };
        label = `"${s.title}"`;
      }
      const same = (r: SyncRule) => JSON.stringify(r) === JSON.stringify(rule);

      if (cmd === "unsync") {
        state.rules = state.rules.filter((r) => !same(r));
        saveState(state);
        console.log(`Stopped syncing ${label}. Already-uploaded steps stay on the server.`);
        return;
      }

      const cfg = requireLogin();
      if (!state.rules.some(same)) state.rules.push(rule);
      saveState(state);
      console.log(`Allowed to sync: ${label}`);
      const targets = listSessionFiles().map(parseSession).filter((s) => isAuthorized({ rules: [rule] }, s));
      for (const s of targets) {
        const r = await syncSession(s, cfg);
        console.log(`  ↑ ${s.source} ${s.sessionId.slice(0, 8)} "${s.title}" — ${r.stepCount} steps on server (+${r.sent})`);
      }
      if (targets.length === 0) console.log("  No matching sessions yet; new ones will sync while `anydock watch` runs.");
      return;
    }

    case "rules": {
      const { rules } = loadState();
      if (rules.length === 0) return console.log("Nothing is allowed to sync. Use: anydock sync <session-id> | --dir [path]");
      for (const r of rules) console.log(r.kind === "dir" ? `dir      ${tilde(r.path)}` : `session  ${r.source} ${r.sessionId}`);
      return;
    }

    case "mcp":
      if (arg === "install") return installMcp();
      if (arg === "uninstall") return uninstallMcp();
      updateInBackground();
      return serveMcp();

    case "watch":
      requireLogin();
      startAutoUpdate();
      return watchAndSync();

    case "update": {
      const v = await selfUpdate();
      console.log(v ? `Updated AnyDock ${VERSION} → ${v}.` : `AnyDock ${VERSION} is up to date.`);
      return;
    }

    case "version":
      console.log(VERSION);
      return;

    case undefined:
    case "help":
      console.log(HELP);
      return;

    default:
      console.error(`Unknown command "${cmd}".\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

