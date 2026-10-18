import { realPath } from "./config.ts";
import { findSession, listSessionFiles, parseSession } from "./sources/discover.ts";
import type { ParsedSession, Source } from "./sources/types.ts";

// The agent that launched us (MCP server or a shell command it ran); both put their own env vars in the child's
// environment.
export function launchingAgent(): Source | undefined {
  if (Object.keys(process.env).some((k) => k.startsWith("CLAUDE_CODE_"))) return "claude-code";
  if (Object.keys(process.env).some((k) => k.startsWith("CODEX_"))) return "codex";
  return undefined;
}

// The session this agent is running in: the most recently active one of that agent in the current folder.
export function currentSession(idPrefix?: string): ParsedSession {
  const files = listSessionFiles();
  if (idPrefix) return findSession(files, idPrefix);
  const cwd = realPath(process.cwd());
  const agent = launchingAgent();
  const candidates = files.filter((f) => !agent || f.source === agent);
  for (const f of candidates.slice(0, 50)) {
    const s = parseSession(f);
    if (s.cwd && realPath(s.cwd) === cwd) return s;
  }
  throw new Error(`Couldn't find an active ${agent ?? "agent"} session for ${cwd}. Pass "session" explicitly (see: anydock sessions).`);
}

// Best effort: the current session if we're inside one, else nothing (an artifact can live without a Work).
export function maybeCurrentSession(): { source: Source; sessionId: string } | undefined {
  if (!launchingAgent()) return undefined;
  try {
    const s = currentSession();
    return { source: s.source, sessionId: s.sessionId };
  } catch {
    return undefined;
  }
}
