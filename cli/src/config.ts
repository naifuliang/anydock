import { chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { Source } from "./sources/types.ts";

// Everything lives in ~/.anydock (override with ANYDOCK_HOME for tests).
export const HOME = process.env.ANYDOCK_HOME ?? join(homedir(), ".anydock");
const CONFIG = join(HOME, "config.json");
const STATE = join(HOME, "state.json");

export const DEFAULT_SERVER = "https://anydock.ai";

export interface Config {
  server: string;
  token?: string;
  user?: { id: string; email: string; name: string };
}

// What the user has authorized to sync. Nothing leaves the machine unless a rule matches.
export type SyncRule =
  | { kind: "session"; source: Source; sessionId: string }
  | { kind: "dir"; path: string };

export interface State {
  rules: SyncRule[];
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

// Write via rename so a crash never leaves a half-written file; 0600 because config holds the token.
function writeJson(path: string, value: unknown): void {
  mkdirSync(HOME, { recursive: true, mode: 0o700 });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
  chmodSync(path, 0o600);
}

export function loadConfig(): Config {
  const cfg = readJson<Partial<Config>>(CONFIG, {});
  return { ...cfg, server: process.env.ANYDOCK_SERVER ?? cfg.server ?? DEFAULT_SERVER };
}

export function saveConfig(cfg: Config): void {
  writeJson(CONFIG, cfg);
}

export function loadState(): State {
  return { rules: [], ...readJson<Partial<State>>(STATE, {}) };
}

export function saveState(state: State): void {
  writeJson(STATE, state);
}

// Compare folders by real path: symlinks (e.g. macOS /var -> /private/var) name the same place differently.
export function realPath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

export function isAuthorized(state: State, s: { source: Source; sessionId: string; cwd?: string }): boolean {
  return state.rules.some((r) => {
    if (r.kind === "session") return r.source === s.source && r.sessionId === s.sessionId;
    if (!s.cwd) return false;
    const cwd = realPath(s.cwd);
    const dir = realPath(r.path);
    return cwd === dir || cwd.startsWith(dir.endsWith("/") ? dir : dir + "/");
  });
}
