import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { redact } from "../redact.ts";
import { CLAUDE_ROOT, parseClaude } from "./claude.ts";
import { CODEX_ROOT, parseCodex } from "./codex.ts";
import type { ParsedSession, SessionFile, Source, Step } from "./types.ts";

export const ROOTS: Record<Source, string> = { "claude-code": CLAUDE_ROOT, codex: CODEX_ROOT };

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith(".jsonl")) out.push(p);
  }
}

// Claude Code keeps subagent transcripts in <session>/subagents/; those belong to their parent, not the list.
function isSessionFile(source: Source, path: string): boolean {
  if (source === "claude-code") return !path.includes("/subagents/") && path.split("/").length === CLAUDE_ROOT.split("/").length + 2;
  return /\/rollout-[^/]+\.jsonl$/.test(path);
}

export function sourceOf(path: string): Source | null {
  if (path.startsWith(CLAUDE_ROOT + "/")) return isSessionFile("claude-code", path) ? "claude-code" : null;
  if (path.startsWith(CODEX_ROOT + "/")) return isSessionFile("codex", path) ? "codex" : null;
  return null;
}

// All session files on this machine, newest first.
export function listSessionFiles(): SessionFile[] {
  const files: SessionFile[] = [];
  for (const source of Object.keys(ROOTS) as Source[]) {
    const paths: string[] = [];
    walk(ROOTS[source], paths);
    for (const path of paths) {
      if (!isSessionFile(source, path)) continue;
      files.push({ source, path, mtimeMs: statSync(path).mtimeMs });
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

// Parsing is the expensive part; cache per file by mtime so the watcher and listings stay cheap.
const cache = new Map<string, { mtimeMs: number; parsed: ParsedSession }>();

export function parseSession(file: SessionFile): ParsedSession {
  const hit = cache.get(file.path);
  if (hit && hit.mtimeMs === file.mtimeMs) return hit.parsed;
  const parsed = file.source === "claude-code" ? parseClaude(file.path) : parseCodex(file.path);
  cache.set(file.path, { mtimeMs: file.mtimeMs, parsed });
  return parsed;
}

// The exact steps that may leave the machine.
export function uploadableSteps(s: ParsedSession): Step[] {
  return s.steps.map((step) => ({
    ...step,
    ...(step.text !== undefined ? { text: redact(step.text) } : {}),
    ...(step.input !== undefined ? { input: redact(step.input) } : {}),
  }));
}

export function findSession(files: SessionFile[], idPrefix: string): ParsedSession {
  const matches = files.map(parseSession).filter((s) => s.sessionId.startsWith(idPrefix));
  if (matches.length === 0) throw new Error(`No local session matches "${idPrefix}". Run: anydock sessions`);
  if (matches.length > 1) throw new Error(`"${idPrefix}" matches ${matches.length} sessions; use more characters.`);
  return matches[0]!;
}
