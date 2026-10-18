import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME } from "../config.ts";
import { ICON_PNG_BASE64 } from "./icon-png.ts";
import { VERSION } from "../version.ts";

// Native Mac helpers are built as real app bundles (~/.anydock/apps/<kind>-<hash>/AnyDock.app), not bare binaries, so
// macOS shows them as "AnyDock" with the AnyDock icon — in the Dock, the menu bar, ⌘-Tab and the Touch ID dialog.
// Compiled from source with swiftc on first use and cached by the source hash; ad-hoc signed.
const APPS = join(HOME, "apps");

export function appExecutable(kind: string, hash: string): string {
  return join(APPS, `${kind}-${hash}`, "AnyDock.app", "Contents", "MacOS", "AnyDock");
}

export function buildApp(opts: { kind: string; hash: string; source: string; bundleId: string; background: boolean }): string | null {
  const exe = appExecutable(opts.kind, opts.hash);
  if (existsSync(exe)) return exe;
  const root = join(APPS, `${opts.kind}-${opts.hash}`);
  const app = join(root, "AnyDock.app");
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(app, "Contents", "MacOS"), { recursive: true });
  mkdirSync(join(app, "Contents", "Resources"), { recursive: true });

  const src = join(root, `${opts.kind}.swift`);
  writeFileSync(src, opts.source);
  const r = spawnSync("xcrun", ["swiftc", "-O", "-o", exe, src], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`AnyDock: couldn't build the ${opts.kind} app: ${r.stderr.split("\n").slice(0, 3).join(" ")}`);
    rmSync(root, { recursive: true, force: true });
    return null;
  }
  const icon = makeIcns(root, join(app, "Contents", "Resources", "AnyDock.icns"));
  writeFileSync(join(app, "Contents", "Info.plist"), plist({
    CFBundleExecutable: "AnyDock", CFBundleIdentifier: opts.bundleId, CFBundleName: "AnyDock", CFBundleDisplayName: "AnyDock",
    CFBundlePackageType: "APPL", CFBundleShortVersionString: VERSION.split("+")[0]!, CFBundleVersion: opts.hash,
    ...(icon ? { CFBundleIconFile: "AnyDock" } : {}), LSMinimumSystemVersion: "12.0", NSHighResolutionCapable: true,
    LSUIElement: opts.background, NSHumanReadableCopyright: "AnyDock",
  }));
  // Seal the bundle (Info.plist + icon) with an ad-hoc signature so macOS treats it as one app.
  spawnSync("codesign", ["--force", "--sign", "-", app], { stdio: "ignore" });
  cleanOld(opts.kind, opts.hash);
  return exe;
}

// AnyDock.icns from the embedded 512px mark, via the sips and iconutil that ship with macOS.
function makeIcns(root: string, out: string): boolean {
  const png = join(root, "icon.png");
  const set = join(root, "AnyDock.iconset");
  writeFileSync(png, Buffer.from(ICON_PNG_BASE64, "base64"));
  mkdirSync(set, { recursive: true });
  for (const size of [16, 32, 128, 256]) {
    for (const [scale, px] of [["", size], ["@2x", size * 2]] as const) {
      spawnSync("sips", ["-z", String(px), String(px), png, "--out", join(set, `icon_${size}x${size}${scale}.png`)], { stdio: "ignore" });
    }
  }
  spawnSync("sips", ["-z", "512", "512", png, "--out", join(set, "icon_512x512.png")], { stdio: "ignore" });
  const ok = spawnSync("iconutil", ["-c", "icns", set, "-o", out], { stdio: "ignore" }).status === 0;
  rmSync(set, { recursive: true, force: true });
  return ok;
}

function plist(values: Record<string, string | boolean>): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = Object.entries(values)
    .map(([k, v]) => `  <key>${k}</key>\n  ${typeof v === "boolean" ? (v ? "<true/>" : "<false/>") : `<string>${esc(v)}</string>`}`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n`;
}

// Earlier builds of the same helper (other hashes), and the bare binaries from before bundles.
function cleanOld(kind: string, hash: string): void {
  try {
    for (const d of readdirSync(APPS)) if (d.startsWith(`${kind}-`) && d !== `${kind}-${hash}`) rmSync(join(APPS, d), { recursive: true, force: true });
    const legacy = { viewer: "anydock-viewer-", approve: "anydock-approve-" }[kind];
    if (legacy) for (const f of readdirSync(join(HOME, "bin"))) if (f.startsWith(legacy)) rmSync(join(HOME, "bin", f), { force: true });
  } catch {}
}
