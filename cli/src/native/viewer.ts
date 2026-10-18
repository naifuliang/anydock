import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { loadConfig } from "../config.ts";
import { appExecutable, buildApp } from "./bundle.ts";
import { VIEWER_SWIFT } from "./viewer-swift.ts";

// `anydock open`: on a Mac, the artifact in its own native window, already signed in; elsewhere, the default browser.
const HASH = createHash("sha256").update(VIEWER_SWIFT).digest("hex").slice(0, 10);

// An "AnyDock" app with the AnyDock icon in the Dock and menu bar (see bundle.ts).
function viewerHelper(): string | null {
  if (process.platform !== "darwin" || process.env.ANYDOCK_NO_NATIVE_APPROVAL) return null;
  if (existsSync(appExecutable("viewer", HASH))) return appExecutable("viewer", HASH);
  if (spawnSync("xcrun", ["--find", "swiftc"], { stdio: "ignore" }).status !== 0) return null;
  return buildApp({ kind: "viewer", hash: HASH, source: VIEWER_SWIFT, bundleId: "ai.anydock.viewer", background: false });
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
