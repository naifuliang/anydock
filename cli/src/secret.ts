import { spawnSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import { KEYCHAIN_SWIFT } from "./native/keychain-swift.ts";

// Where the sign-in token lives — never in plain text on disk:
//   keychain     macOS Keychain, readable only by AnyDock's own helper (others trigger a macOS password prompt)
//   secret-tool  Linux desktop keyring (GNOME Keyring / KWallet via libsecret)
//   file         AES-256-GCM encrypted file, for machines with neither
// None of these can stop a program running as the same user from asking AnyDock to act — so the server treats this
// token as an *agent* token: it can request and deny, but never approve, change rules or connect tools.
export type Store = "keychain" | "secret-tool" | "file";

const HOME = process.env.ANYDOCK_HOME ?? join(homedir(), ".anydock");
const SERVICE = "ai.anydock.cli";
const HASH = createHash("sha256").update(KEYCHAIN_SWIFT).digest("hex").slice(0, 10);
const KEYCHAIN_BIN = join(HOME, "bin", `anydock-keychain-${HASH}`);
const TOKEN_FILE = join(HOME, "token.enc");
const SALT_FILE = join(HOME, ".token-salt");

function keychainHelper(): string | null {
  if (existsSync(KEYCHAIN_BIN)) return KEYCHAIN_BIN;
  mkdirSync(join(HOME, "bin"), { recursive: true });
  const src = `${KEYCHAIN_BIN}.swift`;
  writeFileSync(src, KEYCHAIN_SWIFT);
  const r = spawnSync("xcrun", ["swiftc", "-O", "-o", KEYCHAIN_BIN, src], { encoding: "utf8" });
  return r.status === 0 ? KEYCHAIN_BIN : null;
}

const has = (cmd: string) => spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;

// Pick the strongest store this machine has. Tests (and ANYDOCK_TOKEN_STORE=file) use the encrypted file.
export function bestStore(): Store {
  const forced = process.env.ANYDOCK_TOKEN_STORE as Store | undefined;
  if (forced === "file" || forced === "keychain" || forced === "secret-tool") return forced;
  if (process.env.ANYDOCK_NO_NATIVE_APPROVAL) return "file";
  if (process.platform === "darwin" && (existsSync(KEYCHAIN_BIN) || has("xcrun"))) return "keychain";
  if (process.platform === "linux" && process.env.DBUS_SESSION_BUS_ADDRESS && has("secret-tool")) return "secret-tool";
  return "file";
}

// ---------- encrypted file ----------
// The key is derived from a random salt kept in a separate file plus this user (and machine id on Linux), so the token file alone
// (copied, pasted, backed up) decrypts to nothing.
function fileKey(): Buffer {
  if (!existsSync(SALT_FILE)) {
    mkdirSync(HOME, { recursive: true, mode: 0o700 });
    writeFileSync(SALT_FILE, randomBytes(32), { mode: 0o600 });
  }
  // Stable inputs only (a hostname changes with the network on macOS).
  let machine = "";
  for (const f of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    try { machine = readFileSync(f, "utf8").trim(); break; } catch {}
  }
  return createHash("sha256").update(readFileSync(SALT_FILE)).update(`${machine}:${userInfo().uid}:anydock-token-v1`).digest();
}

function fileWrite(account: string, token: string): void {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", fileKey(), iv);
  c.setAAD(Buffer.from(account));
  const body = Buffer.concat([c.update(token, "utf8"), c.final()]);
  mkdirSync(HOME, { recursive: true, mode: 0o700 });
  writeFileSync(TOKEN_FILE, JSON.stringify({ v: 1, account, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), body: body.toString("base64") }), { mode: 0o600 });
  chmodSync(TOKEN_FILE, 0o600);
}

function fileRead(account: string): string | undefined {
  try {
    const f = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    if (f.account !== account) return undefined;
    const d = createDecipheriv("aes-256-gcm", fileKey(), Buffer.from(f.iv, "base64"));
    d.setAAD(Buffer.from(account));
    d.setAuthTag(Buffer.from(f.tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(f.body, "base64")), d.final()]).toString("utf8");
  } catch {
    return undefined;
  }
}

// ---------- public API (synchronous: config is read everywhere) ----------

// The OS keychain / keyring is shared by every AnyDock home on this machine, so each home gets its own entry (the
// account's real ~/.anydock keeps the plain server URL). Two identities on one Mac never overwrite each other.
const REAL_HOME = join(userInfo().homedir, ".anydock");
const osAccount = (account: string) => (HOME === REAL_HOME ? account : `${account}#${HOME}`);

export function readToken(store: Store, account: string): string | undefined {
  if (store === "keychain") {
    const bin = keychainHelper();
    if (!bin) return undefined;
    const r = spawnSync(bin, ["get", SERVICE, osAccount(account)], { encoding: "utf8" });
    return r.status === 0 && r.stdout ? r.stdout : undefined;
  }
  if (store === "secret-tool") {
    const r = spawnSync("secret-tool", ["lookup", "service", SERVICE, "account", osAccount(account)], { encoding: "utf8" });
    return r.status === 0 && r.stdout ? r.stdout.trim() : undefined;
  }
  return fileRead(account);
}

// Returns the store actually used (falls back to the encrypted file if the OS store fails).
export function writeToken(store: Store, account: string, token: string): Store {
  if (store === "keychain") {
    const bin = keychainHelper();
    if (bin && spawnSync(bin, ["set", SERVICE, osAccount(account)], { input: token }).status === 0) return "keychain";
  } else if (store === "secret-tool") {
    if (spawnSync("secret-tool", ["store", "--label=AnyDock sign-in", "service", SERVICE, "account", osAccount(account)], { input: token }).status === 0) return "secret-tool";
  }
  fileWrite(account, token);
  return "file";
}

export function deleteToken(store: Store | undefined, account: string): void {
  if (store === "keychain" && existsSync(KEYCHAIN_BIN)) spawnSync(KEYCHAIN_BIN, ["delete", SERVICE, osAccount(account)]);
  if (store === "secret-tool") spawnSync("secret-tool", ["clear", "service", SERVICE, "account", osAccount(account)]);
  rmSync(TOKEN_FILE, { force: true });
}
