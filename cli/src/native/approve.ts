import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME } from "../config.ts";
import { APPROVE_SWIFT } from "./approve-swift.ts";

// The native approval panel (macOS). Built from source with swiftc into ~/.anydock/bin on first use and cached by hash,
// so updating the CLI rebuilds it automatically. Anything else (Linux, no Xcode tools) reports "unavailable" and callers
// fall back to the in-agent prompt or the dashboard.
export type LocalVerdict = "approve" | "deny" | "timeout" | "unavailable";
export type LocalResult = { verdict: LocalVerdict; signature?: string };

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

// This Mac's approval key: a Secure Enclave P-256 key that only signs after Touch ID or the password. The private part
// never leaves the Secure Enclave; the file holds an opaque blob only this Mac can use. Returns the public key (base64).
export const APPROVAL_KEY = join(HOME, "approval-key");
export function ensureApprovalKey(opts: { fresh?: boolean } = {}): string | null {
  if (!nativeApprovalPossible()) return null;
  const pub = `${APPROVAL_KEY}.pub`;
  if (opts.fresh) rmSync(APPROVAL_KEY, { force: true });
  if (!opts.fresh && existsSync(APPROVAL_KEY) && existsSync(pub)) return readFileSync(pub, "utf8").trim();
  const bin = ensureApprovalHelper();
  if (!bin) return null;
  const r = spawnSync(bin, ["keygen", APPROVAL_KEY], { encoding: "utf8" });
  const key = r.stdout.trim();
  if (r.status !== 0 || !key || key === "unavailable") return null;
  writeFileSync(pub, key + "\n");
  return key;
}

// message = the exact bytes the server expects signed (see server/src/trust.ts approvalMessage).
export function askOnThisMac(opts: { summary: string; message: string; agent: string; rule?: string; timeoutSec?: number; signal?: AbortSignal }): Promise<LocalResult> {
  const bin = ensureApprovalHelper();
  if (!bin || !existsSync(APPROVAL_KEY)) return Promise.resolve({ verdict: "unavailable" });
  return new Promise((resolve) => {
    const args = ["--summary", opts.summary, "--agent", opts.agent, "--rule", opts.rule ?? "ask me", "--timeout", String(opts.timeoutSec ?? 120),
      "--key", APPROVAL_KEY, "--message", Buffer.from(opts.message, "utf8").toString("base64")];
    const p = spawn(bin, args, {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    // Decided somewhere else (dashboard, Slack): close the panel.
    opts.signal?.addEventListener("abort", () => p.kill());
    p.on("error", () => resolve({ verdict: "unavailable" }));
    p.on("exit", () => {
      const [v, signature] = (out.trim().split("\n").pop() ?? "").split(" ") as [LocalVerdict, string?];
      if (v === "approve") resolve(signature ? { verdict: "approve", signature } : { verdict: "unavailable" });
      else resolve({ verdict: ["deny", "timeout", "unavailable"].includes(v) ? v : "unavailable" });
    });
  });
}
