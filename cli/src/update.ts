import { createHash } from "node:crypto";
import { chmodSync, renameSync, writeFileSync } from "node:fs";
import { loadConfig } from "./config.ts";
import { BUILD, ENTRY, VERSION } from "./version.ts";

interface Latest {
  version: string;
  build: number;
  url: string;
  sha256: string;
}

export async function latestRelease(server = loadConfig().server): Promise<Latest> {
  const res = await fetch(`${server}/cli/version.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't check for updates (HTTP ${res.status}).`);
  return (await res.json()) as Latest;
}

// Replace the installed bundle with the newest one. Returns the new version, or null if already current.
export async function selfUpdate(): Promise<string | null> {
  if (BUILD === 0) throw new Error("This is a dev run (node src/main.ts); update with git instead.");
  const cfg = loadConfig();
  const latest = await latestRelease(cfg.server);
  if (latest.build <= BUILD) return null;

  const res = await fetch(new URL(latest.url, cfg.server), { cache: "no-store" });
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

// Long-running commands call this: on update, re-exec the same command line with the new code.
export function startAutoUpdate(everyMs = 6 * 3600_000): void {
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

// Short-lived or agent-managed processes (the MCP server): update the file for next launch, never restart.
export function updateInBackground(): void {
  if (BUILD === 0) return;
  selfUpdate().catch(() => {});
}
