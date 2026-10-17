import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { clip, isInjected, LIMITS, titleFrom, type ParsedSession, type Step } from "./types.ts";

// Claude Code: ~/.claude/projects/<cwd-slug>/<sessionId>.jsonl, one JSON event per line.
export const CLAUDE_ROOT = process.env.ANYDOCK_CLAUDE_ROOT ?? join(homedir(), ".claude", "projects");

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string | { type: string; text?: string }[] }
  | { type: string; [k: string]: unknown };

const resultText = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c) => (c?.type === "text" ? c.text : `[${c?.type}]`)).join("\n")
      : "";

export function parseClaude(path: string): ParsedSession {
  const steps: Step[] = [];
  const toolNames = new Map<string, string>();
  let sessionId = basename(path, ".jsonl");
  let title: string | undefined;
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
      continue; // the last line may be mid-write
    }
    if (ev.type === "custom-title" && ev.customTitle) title = ev.customTitle;
    if (ev.type === "summary" && ev.summary && !title) title = ev.summary;
    if (ev.type !== "user" && ev.type !== "assistant") continue;
    if (ev.isMeta || ev.isSidechain || ev.isCompactSummary) continue;

    sessionId = ev.sessionId ?? sessionId;
    cwd ??= ev.cwd;
    gitBranch = ev.gitBranch || gitBranch;
    startedAt ??= ev.timestamp;
    lastActivityAt = ev.timestamp ?? lastActivityAt;
    const ts: string | undefined = ev.timestamp;
    const content: string | Block[] = ev.message?.content ?? [];
    const blocks: Block[] = typeof content === "string" ? [{ type: "text", text: content }] : content;

    for (const b of blocks) {
      if (b.type === "text" && typeof b.text === "string") {
        if (ev.type === "user" && isInjected(b.text)) continue;
        steps.push({ ts, role: ev.type, type: "text", text: clip(b.text, LIMITS.text) });
      } else if (b.type === "tool_use") {
        const u = b as { id: string; name: string; input: unknown };
        toolNames.set(u.id, u.name);
        steps.push({ ts, role: "assistant", type: "tool_call", tool: u.name, input: clip(JSON.stringify(u.input ?? {}), LIMITS.input) });
      } else if (b.type === "tool_result") {
        const r = b as { tool_use_id: string; content: unknown };
        steps.push({ ts, role: "tool", type: "tool_result", tool: toolNames.get(r.tool_use_id), text: clip(resultText(r.content), LIMITS.result) });
      }
    }
  }

  return { source: "claude-code", sessionId, path, title: title ?? titleFrom(steps), cwd, gitBranch, startedAt, lastActivityAt, steps };
}
