import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { clip, isInjected, LIMITS, titleFrom, type ParsedSession, type Step } from "./types.ts";

// Codex: ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl; thread names in ~/.codex/session_index.jsonl.
const CODEX_HOME = process.env.ANYDOCK_CODEX_HOME ?? process.env.CODEX_HOME ?? join(homedir(), ".codex");
export const CODEX_ROOT = join(CODEX_HOME, "sessions");

// Re-read on each parse: Codex renames threads as the conversation goes on. The file is small.
function threadNames(): Map<string, string> {
  const names = new Map<string, string>();
  const index = join(CODEX_HOME, "session_index.jsonl");
  if (!existsSync(index)) return names;
  for (const line of readFileSync(index, "utf8").split("\n")) {
    try {
      const r = JSON.parse(line);
      if (r.id && r.thread_name) names.set(r.id, r.thread_name);
    } catch {}
  }
  return names;
}

const texts = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c) => (typeof c?.text === "string" ? c.text : "")).filter(Boolean).join("\n")
      : "";

export function parseCodex(path: string): ParsedSession {
  const steps: Step[] = [];
  const toolNames = new Map<string, string>();
  let sessionId = basename(path, ".jsonl").replace(/^rollout-[\dT:-]+?-(?=[0-9a-f]{8}-)/, "");
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let startedAt: string | undefined;
  let lastActivityAt: string | undefined;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const p = ev.payload ?? {};
    const ts: string | undefined = ev.timestamp;

    if (ev.type === "session_meta") {
      sessionId = p.id ?? p.session_id ?? sessionId;
      cwd = p.cwd ?? cwd;
      gitBranch = p.git?.branch ?? gitBranch;
      startedAt = p.timestamp ?? ts;
      continue;
    }
    if (ev.type !== "response_item") continue;
    lastActivityAt = ts ?? lastActivityAt;

    if (p.type === "message" && (p.role === "user" || p.role === "assistant")) {
      const text = texts(p.content);
      if (p.role === "user" && isInjected(text)) continue;
      if (text) steps.push({ ts, role: p.role, type: "text", text: clip(text, LIMITS.text) });
    } else if (p.type === "function_call" || p.type === "custom_tool_call") {
      const tool = p.namespace ? `${p.namespace}.${p.name}` : p.name;
      toolNames.set(p.call_id, tool);
      steps.push({ ts, role: "assistant", type: "tool_call", tool, input: clip(String(p.arguments ?? p.input ?? ""), LIMITS.input) });
    } else if (p.type === "function_call_output" || p.type === "custom_tool_call_output") {
      steps.push({ ts, role: "tool", type: "tool_result", tool: toolNames.get(p.call_id), text: clip(texts(p.output), LIMITS.result) });
    }
  }

  const title = threadNames().get(sessionId) ?? titleFrom(steps);
  return { source: "codex", sessionId, path, title, cwd, gitBranch, startedAt, lastActivityAt, steps };
}
