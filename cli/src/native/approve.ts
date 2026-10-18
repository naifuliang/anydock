import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME } from "../config.ts";
import { APPROVE_SWIFT } from "./approve-swift.ts";

// The native approval panel (macOS). Built from source with swiftc into ~/.anydock/bin on first use and cached by hash,
// so updating the CLI rebuilds it automatically. Anything else (Linux, no Xcode tools) reports "unavailable" and callers
// fall back to the in-agent prompt or the dashboard.
export type LocalVerdict = "approve" | "deny" | "timeout" | "unavailable";

const HASH = createHash("sha256").update(APPROVE_SWIFT).digest("hex").slice(0, 10);
const BIN = join(HOME, "bin", `anydock-approve-${HASH}`);

export function nativeApprovalPossible(): boolean {
  if (process.platform !== "darwin" || process.env.ANYDOCK_NO_NATIVE_APPROVAL) return false;
  return existsSync(BIN) || spawnSync("xcrun", ["--find", "swiftc"], { stdio: "ignore" }).status === 0;
}

// Compile once (about 10–20 s the first time). Safe to call repeatedly.
export function ensureApprovalHelper(): string | null {
  if (process.platform !== "darwin") return null;
  if (existsSync(BIN)) return BIN;
  mkdirSync(join(HOME, "bin"), { recursive: true });
  const src = join(HOME, "bin", `anydock-approve-${HASH}.swift`);
  writeFileSync(src, APPROVE_SWIFT);
  const r = spawnSync("xcrun", ["swiftc", "-O", "-o", BIN, src], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`AnyDock: couldn't build the approval panel: ${r.stderr.split("\n").slice(0, 3).join(" ")}`);
    return null;
  }
  return BIN;
}

export function askOnThisMac(opts: { summary: string; agent: string; rule?: string; timeoutSec?: number; signal?: AbortSignal }): Promise<LocalVerdict> {
  const bin = ensureApprovalHelper();
  if (!bin) return Promise.resolve("unavailable");
  return new Promise((resolve) => {
    const p = spawn(bin, ["--summary", opts.summary, "--agent", opts.agent, "--rule", opts.rule ?? "ask me", "--timeout", String(opts.timeoutSec ?? 120)], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    // Decided somewhere else (dashboard, Slack): close the panel.
    opts.signal?.addEventListener("abort", () => p.kill());
    p.on("error", () => resolve("unavailable"));
    p.on("exit", () => {
      const v = out.trim().split("\n").pop() as LocalVerdict;
      resolve(["approve", "deny", "timeout", "unavailable"].includes(v) ? v : "unavailable");
    });
  });
}
