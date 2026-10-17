export type Source = "claude-code" | "codex";

// One normalized step of an agent trajectory, the same shape for every source.
export interface Step {
  ts?: string;
  role: "user" | "assistant" | "tool";
  type: "text" | "tool_call" | "tool_result";
  text?: string;
  tool?: string;
  input?: string;
}

export interface SessionFile {
  source: Source;
  path: string;
  mtimeMs: number;
}

export interface ParsedSession {
  source: Source;
  sessionId: string;
  path: string;
  title: string;
  cwd?: string;
  gitBranch?: string;
  startedAt?: string;
  lastActivityAt?: string;
  steps: Step[];
}

// Keep uploads small: agents often dump whole files into tool results.
export const LIMITS = { text: 8_000, input: 2_000, result: 2_000 };

export function clip(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}… [${s.length - max} more chars]`;
}

// Text an agent harness injects into the "user" role (reminders, command wrappers, env context).
export function isInjected(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("<") || t.startsWith("Caveat:") || t.startsWith("# AGENTS.md") || t.length === 0;
}

export function titleFrom(steps: Step[]): string {
  const first = steps.find((s) => s.role === "user" && s.type === "text" && s.text);
  const line = first?.text?.split("\n").find((l) => l.trim()) ?? "Untitled session";
  return clip(line.trim(), 120).replace(/… \[\d+ more chars\]$/, "…");
}
