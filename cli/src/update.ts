import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME, loadConfig } from "./config.ts";
import { BUILD, ENTRY, VERSION } from "./version.ts";

interface Latest {
  version: string;
  build: number;
  url: string;
  sha256: string;
}

export async function latestRelease(server = loadConfig().server): Promise<Latest> {
  // A unique query string so no edge or proxy cache can hand back an older version.json.
  const res = await fetch(`${server}/cli/version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't check for updates (HTTP ${res.status}).`);
  return (await res.json()) as Latest;
}

// Replace the installed bundle with the newest one. Returns the new version, or null if already current.
export async function selfUpdate(): Promise<string | null> {
  if (BUILD === 0) throw new Error("This is a dev run (node src/main.ts); update with git instead.");
  const cfg = loadConfig();
  const latest = await latestRelease(cfg.server);
  if (latest.build <= BUILD) return null;

  const res = await fetch(new URL(`${latest.url}?sha=${latest.sha256}`, cfg.server), { cache: "no-store" }); // cache key per build
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}).`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== latest.sha256) throw new Error("Downloaded update failed its checksum; keeping the current version.");

  // Write next to the old file and rename over it, so a running process never sees a half-written file.
  const tmp = `${ENTRY}.update`;
  writeFileSync(tmp, bytes, { mode: 0o755 });
  renameSync(tmp, ENTRY);
  chmodSync(ENTRY, 0o755);
  return latest.version;
}

// How often long-running processes look for a new version (one small JSON request).
export const CHECK_EVERY_MS = 15 * 60_000;

// Long-running commands call this: on update, re-exec the same command line with the new code.
export function startAutoUpdate(everyMs = CHECK_EVERY_MS): void {
  if (BUILD === 0) return;
  const tick = async () => {
    try {
      const v = await selfUpdate();
      if (!v) return;
      console.log(`Updated AnyDock ${VERSION} → ${v}; restarting…`);
      const execve = (process as unknown as { execve?: (file: string, args: string[], env: NodeJS.ProcessEnv) => never }).execve;
      if (execve) execve(process.execPath, [process.execPath, ...process.argv.slice(1)], process.env);
      console.log("Restart `anydock watch` to finish the update.");
    } catch {
      // Offline or server down: try again next tick.
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, everyMs).unref();
}

// Has the installed file changed since this process started (updated by us or by another AnyDock process)?
const startedMtime = (() => { try { return statSync(ENTRY).mtimeMs; } catch { return 0; } })();
export function installedChanged(): boolean {
  try { return statSync(ENTRY).mtimeMs !== startedMtime; } catch { return false; }
}

// Agent-managed processes (the MCP server): update the file now and then; the caller decides when to reload.
export function watchForUpdates(onNewVersion: () => void, everyMs = CHECK_EVERY_MS): void {
  if (BUILD === 0) return;
  const tick = async () => {
    await selfUpdate().catch(() => null);
    if (installedChanged()) onNewVersion();
  };
  setTimeout(tick, 5_000);
  setInterval(tick, everyMs).unref();
}

// Once per new version: refresh what lives outside the bundle — the agents' skill files, and the native Mac helpers,
// which compile in the background (~20 s) so the first approval after an update doesn't wait. Runs detached.
const APPLIED = join(HOME, "applied-build");
export function afterUpdateInBackground(): void {
  if (BUILD === 0 || process.env.ANYDOCK_NO_NATIVE_APPROVAL) return;
  let applied = "";
  try { applied = readFileSync(APPLIED, "utf8").trim(); } catch {}
  if (applied === String(BUILD)) return;
  spawn(process.execPath, [ENTRY, "_after-update"], { detached: true, stdio: "ignore", env: process.env }).on("error", () => {}).unref();
}
export async function afterUpdate(): Promise<void> {
  const { installSkills } = await import("./skill.ts");
  installSkills();
  if (process.platform === "darwin") {
    const { ensureApprovalHelper } = await import("./native/approve.ts");
    const { ensureViewer } = await import("./native/viewer.ts");
    ensureApprovalHelper();
    ensureViewer();
  }
  writeFileSync(APPLIED, String(BUILD));
}
