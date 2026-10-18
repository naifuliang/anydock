import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME, loadConfig } from "../config.ts";
import { VIEWER_SWIFT } from "./viewer-swift.ts";

// `anydock open`: on a Mac, the artifact in its own native window, already signed in; elsewhere, the default browser.
const HASH = createHash("sha256").update(VIEWER_SWIFT).digest("hex").slice(0, 10);
const BIN = join(HOME, "bin", `anydock-viewer-${HASH}`);

function viewerHelper(): string | null {
  if (process.platform !== "darwin" || process.env.ANYDOCK_NO_NATIVE_APPROVAL) return null;
  if (existsSync(BIN)) return BIN;
  if (spawnSync("xcrun", ["--find", "swiftc"], { stdio: "ignore" }).status !== 0) return null;
  mkdirSync(join(HOME, "bin"), { recursive: true });
  const src = `${BIN}.swift`;
  writeFileSync(src, VIEWER_SWIFT);
  const r = spawnSync("xcrun", ["swiftc", "-O", "-o", BIN, src], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`AnyDock: couldn't build the viewer window: ${r.stderr.split("\n").slice(0, 3).join(" ")}`);
    return null;
  }
  return BIN;
}

export function ensureViewer(): boolean {
  return viewerHelper() !== null;
}

export function openInViewer(url: string, title: string): "window" | "browser" {
  const bin = viewerHelper();
  const cfg = loadConfig();
  if (bin && cfg.token) {
    const p = spawn(bin, ["--url", url, "--title", title], { detached: true, stdio: ["pipe", "ignore", "ignore"] });
    p.stdin.end(cfg.token);
    p.unref();
    return "window";
  }
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  if (!process.env.ANYDOCK_NO_BROWSER) spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  return "browser";
}
