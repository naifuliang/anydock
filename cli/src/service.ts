import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { HOME as ANYDOCK_HOME } from "./config.ts";
import { COMMAND } from "./version.ts";

// Runs `anydock watch` in the background at login, so shared sessions keep syncing without a terminal open.
// macOS: a launchd agent. Linux: a systemd user unit.
const LABEL = "ai.anydock.watch";
const LOG = join(ANYDOCK_HOME, "watch.log");
const PLIST = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const UNIT_DIR = join(homedir(), ".config", "systemd", "user");
const UNIT = join(UNIT_DIR, "anydock-watch.service");

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: "utf8" });
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// `launchctl bootout` returns before the job is gone; bootstrapping too early fails with "5: Input/output error".
function launchdReplace(plist: string): void {
  const target = `${domain()}/${LABEL}`;
  run("launchctl", ["bootout", target]);
  for (let i = 0; i < 50 && run("launchctl", ["print", target]).status === 0; i++) pause(100);
  let last = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = run("launchctl", ["bootstrap", domain(), plist]);
    if (r.status === 0) return;
    last = r.stderr.trim();
    pause(500);
  }
  throw new Error(`launchctl bootstrap failed: ${last}`);
}
const domain = () => `gui/${userInfo().uid}`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Carry test/dev overrides into the service so it talks to the same server and home as this command.
function serviceEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const k of ["ANYDOCK_SERVER", "ANYDOCK_HOME", "ANYDOCK_CLAUDE_ROOT", "ANYDOCK_CODEX_HOME"]) {
    if (process.env[k]) env[k] = process.env[k]!;
  }
  return env;
}

export function installService(): string {
  mkdirSync(ANYDOCK_HOME, { recursive: true });
  const args = [...COMMAND, "watch"];

  if (process.platform === "darwin") {
    const env = serviceEnv();
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array>${args.map((a) => `<string>${xml(a)}</string>`).join("")}</array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${xml(LOG)}</string>
  <key>StandardErrorPath</key><string>${xml(LOG)}</string>
  ${Object.keys(env).length ? `<key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k, v]) => `<key>${k}</key><string>${xml(v)}</string>`).join("")}</dict>` : ""}
</dict></plist>
`;
    mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
    writeFileSync(PLIST, plist);
    launchdReplace(PLIST); // replaces a previous version, if any
    return `Background sync: running (launchd ${LABEL}; log ${LOG.replace(homedir(), "~")}).`;
  }

  if (process.platform === "linux") {
    const env = Object.entries(serviceEnv()).map(([k, v]) => `Environment=${k}=${v}\n`).join("");
    const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
    mkdirSync(UNIT_DIR, { recursive: true });
    writeFileSync(
      UNIT,
      `[Unit]\nDescription=AnyDock live sync\n\n[Service]\nExecStart=${quoted}\nRestart=always\nRestartSec=30\n${env}StandardOutput=append:${LOG}\nStandardError=append:${LOG}\n\n[Install]\nWantedBy=default.target\n`,
    );
    const r1 = run("systemctl", ["--user", "daemon-reload"]);
    const r2 = run("systemctl", ["--user", "enable", "--now", "anydock-watch.service"]);
    if (r1.error || r2.status !== 0) return `Background sync: unit written to ${UNIT}, but systemd --user isn't available; run \`anydock watch\` yourself.`;
    return `Background sync: running (systemd user unit anydock-watch; log ${LOG.replace(homedir(), "~")}).`;
  }

  return "Background sync: not supported on this OS yet; run `anydock watch` in a terminal.";
}

export function uninstallService(): string {
  if (process.platform === "darwin") {
    run("launchctl", ["bootout", `${domain()}/${LABEL}`]);
    if (existsSync(PLIST)) rmSync(PLIST);
    return "Background sync: stopped and removed.";
  }
  if (process.platform === "linux") {
    run("systemctl", ["--user", "disable", "--now", "anydock-watch.service"]);
    if (existsSync(UNIT)) rmSync(UNIT);
    run("systemctl", ["--user", "daemon-reload"]);
    return "Background sync: stopped and removed.";
  }
  return "Background sync: nothing to remove.";
}

export function serviceStatus(): string {
  if (process.platform === "darwin") {
    const r = run("launchctl", ["print", `${domain()}/${LABEL}`]);
    if (r.status !== 0) return "Background sync: not installed (anydock service install).";
    const state = r.stdout.match(/^\s*state = (.+)$/m)?.[1] ?? "unknown";
    const pid = r.stdout.match(/^\s*pid = (\d+)$/m)?.[1];
    return `Background sync: ${state}${pid ? ` (pid ${pid})` : ""}; log ${LOG.replace(homedir(), "~")}`;
  }
  if (process.platform === "linux") {
    const r = run("systemctl", ["--user", "is-active", "anydock-watch.service"]);
    return `Background sync: ${r.stdout.trim() || "not installed"}`;
  }
  return "Background sync: not supported on this OS yet.";
}
