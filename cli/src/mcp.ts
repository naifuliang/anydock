import { createInterface } from "node:readline";
import { api, ApiError } from "./api.ts";
import { loadConfig, loadState, realPath, saveState } from "./config.ts";
import { findSession, listSessionFiles, parseSession } from "./sources/discover.ts";
import type { ParsedSession, Source, Step } from "./sources/types.ts";
import { syncSession } from "./sync.ts";

// `anydock mcp`: a stdio MCP server that Claude Code and Codex launch. Agents use it to share or hand over
// the session they are in, see what teammates sent them, read a teammate's trajectory, and ask why.
// Plain newline-delimited JSON-RPC 2.0 — no SDK, so the CLI stays dependency-free.

const VERSION = "0.1.0";

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  run(args: any): Promise<string>;
}

const sessionArg = {
  type: "string",
  description:
    "Optional local session id (or unique prefix). Defaults to the session this agent is running in: the most recently active one in the current working directory.",
};

// ---------- current session ----------

// The agent that launched us; both put their own env vars in the child's environment.
function launchingAgent(): Source | undefined {
  if (Object.keys(process.env).some((k) => k.startsWith("CLAUDE_CODE_"))) return "claude-code";
  if (Object.keys(process.env).some((k) => k.startsWith("CODEX_"))) return "codex";
  return undefined;
}

function currentSession(idPrefix?: string): ParsedSession {
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

// Sharing a session implies allowing it to sync; the rule keeps later progress flowing to recipients.
async function authorizeAndSync(s: ParsedSession) {
  const state = loadState();
  if (!state.rules.some((r) => r.kind === "session" && r.source === s.source && r.sessionId === s.sessionId)) {
    state.rules.push({ kind: "session", source: s.source, sessionId: s.sessionId });
    saveState(state);
  }
  return syncSession(s);
}

// ---------- formatting for agents (compact, numbered, token-aware) ----------

const one = (s: string | undefined, max: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

function formatStep(i: number, s: Step, textMax = 1500, toolMax = 300): string {
  if (s.type === "text") return `[${i}] ${s.role}: ${one(s.text, textMax)}`;
  if (s.type === "tool_call") return `[${i}] assistant → ${s.tool ?? "tool"} ${one(s.input, toolMax)}`;
  return `[${i}] ${s.tool ?? "tool"} ← ${one(s.text, toolMax)}`;
}

interface Work {
  id: string;
  title: string;
  source: string;
  role: string;
  stepCount: number;
  ownerName?: string | null;
  ownerEmail?: string | null;
  assigneeEmail?: string | null;
  cwd?: string | null;
  gitBranch?: string | null;
  lastActivityAt?: string | null;
}

const who = (w: Work) => w.ownerName || w.ownerEmail || "unknown";

function workHeader(w: Work): string {
  return [
    `Work ${w.id}: "${w.title}"`,
    `by ${who(w)} · ${w.source} · ${w.stepCount} steps · your access: ${w.role}` +
      (w.assigneeEmail ? ` · assigned to ${w.assigneeEmail}` : ""),
    w.cwd ? `folder: ${w.cwd}${w.gitBranch ? ` (branch ${w.gitBranch})` : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function allSteps(workId: string): Promise<Step[]> {
  const steps: Step[] = [];
  for (let from = 0; ; from += 2000) {
    const page = await api<{ steps: Step[]; stepCount: number }>("GET", `/api/works/${workId}/steps?from=${from}&limit=2000`);
    steps.push(...page.steps);
    if (steps.length >= page.stepCount || page.steps.length === 0) return steps;
  }
}

// Lexical relevance: enough to surface the right moments; the calling agent does the reasoning.
const STOP = new Set("the a an and or of to in on for with is are was were be it this that why how what did do does you we i my our from by at as".split(" "));
const terms = (s: string) => [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((t) => t.length > 1 && !STOP.has(t)))];

function relevant(steps: Step[], question: string, k = 12): number[] {
  const q = terms(question);
  const scored = steps.map((s, i) => {
    const hay = `${s.text ?? ""} ${s.input ?? ""} ${s.tool ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of q) if (hay.includes(t)) score += 1;
    // Decisions and reasoning live in prose, not tool output.
    if (s.type === "text") score *= s.role === "assistant" ? 1.5 : 1.2;
    return { i, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, k)
    .map((x) => x.i);
}

// ---------- tools ----------

const tools: Tool[] = [
  {
    name: "anydock_share",
    description:
      "Share the work in this agent session with a teammate by email (they get it in their AnyDock inbox and their agent can read the trajectory and ask why). Uploads the session, and keeps syncing new progress to them.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Teammate's email address" },
        note: { type: "string", description: "Optional message, e.g. what to look at or what to do next" },
        session: sessionArg,
      },
      required: ["to"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (a) => shareOrHandover("share", a),
  },
  {
    name: "anydock_handover",
    description:
      "Hand this agent session's work over to a teammate by email: they become responsible for it and get the full context (trajectory, decisions, open threads). Use when the user says 'hand this over to …'.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Teammate's email address" },
        note: { type: "string", description: "Handover note: where things stand and what's next" },
        session: sessionArg,
      },
      required: ["to"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (a) => shareOrHandover("handover", a),
  },
  {
    name: "anydock_inbox",
    description: "List work that teammates shared or handed over to the user, newest first, with work ids to read.",
    inputSchema: {
      type: "object",
      properties: { unread_only: { type: "boolean", description: "Only unread items (default false)" } },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) {
      const { items } = await api<{ items: any[] }>("GET", `/api/inbox${a.unread_only ? "?unread=1" : ""}`);
      if (items.length === 0) return "Inbox is empty.";
      return items
        .map((i) =>
          `- ${i.readAt ? "" : "[new] "}${i.kind === "handover" ? "Handover" : "Shared"} from ${i.fromName || i.fromEmail}: "${i.workTitle}" (work ${i.workId}, ${i.createdAt.slice(0, 16).replace("T", " ")})` +
          (i.body ? `\n  note: ${i.body}` : ""),
        )
        .join("\n");
    },
  },
  {
    name: "anydock_list_works",
    description: "List works the user can access: their own uploaded sessions, ones shared or handed to them, and their projects'.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run() {
      const { works } = await api<{ works: Work[] }>("GET", "/api/works");
      if (works.length === 0) return "No works yet.";
      return works.map((w) => `- ${w.id}  "${w.title}"  by ${who(w)} · ${w.role} · ${w.stepCount} steps · ${w.source}`).join("\n");
    },
  },
  {
    name: "anydock_read_work",
    description:
      "Read a shared work's trajectory: the teammate's prompts, their agent's reasoning, and tool calls, as numbered steps. Use it to pick up a handover or to redo what a teammate did. Long outputs are clipped; page with from/limit.",
    inputSchema: {
      type: "object",
      properties: {
        work_id: { type: "string" },
        from: { type: "number", description: "First step index (default 0)" },
        limit: { type: "number", description: "Max steps (default 150)" },
        include_tools: { type: "boolean", description: "Include tool calls and results (default true)" },
      },
      required: ["work_id"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) {
      const { work } = await api<{ work: Work }>("GET", `/api/works/${a.work_id}`);
      const from = Math.max(0, a.from ?? 0);
      const limit = Math.min(500, Math.max(1, a.limit ?? 150));
      const page = await api<{ steps: Step[]; stepCount: number }>("GET", `/api/works/${a.work_id}/steps?from=${from}&limit=${limit}`);
      const lines = page.steps
        .map((s, k) => ({ s, i: from + k }))
        .filter(({ s }) => a.include_tools !== false || s.type === "text")
        .map(({ s, i }) => formatStep(i, s));
      const next = from + page.steps.length;
      return [
        workHeader(work),
        "",
        ...lines,
        "",
        next < page.stepCount ? `(steps ${from}–${next - 1} of ${page.stepCount}; call again with from=${next} for more)` : `(end of trajectory, ${page.stepCount} steps)`,
      ].join("\n");
    },
  },
  {
    name: "anydock_ask_why",
    description:
      "Ask why or how a teammate's work was done (e.g. 'where did the 32% come from?', 'why pick track A over B?'). Returns the most relevant moments of their trajectory with step numbers, plus their original goal, so you can answer from evidence. Cite step numbers in your answer.",
    inputSchema: {
      type: "object",
      properties: { work_id: { type: "string" }, question: { type: "string" } },
      required: ["work_id", "question"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) {
      const { work } = await api<{ work: Work }>("GET", `/api/works/${a.work_id}`);
      const steps = await allSteps(a.work_id);
      const goals = steps.map((s, i) => ({ s, i })).filter(({ s }) => s.role === "user" && s.type === "text").slice(0, 3);
      const hits = relevant(steps, a.question);
      // Show each hit with one step of context on both sides.
      const shown = new Set<number>();
      for (const i of hits) for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < steps.length) shown.add(j);
      const evidence = [...shown].sort((x, y) => x - y);
      const blocks: string[] = [];
      let prev = -2;
      for (const i of evidence) {
        if (i !== prev + 1 && blocks.length) blocks.push("  …");
        blocks.push(formatStep(i, steps[i]!, 2000, 500));
        prev = i;
      }
      return [
        workHeader(work),
        "",
        `Question: ${a.question}`,
        "",
        "Original goal:",
        ...goals.map(({ s, i }) => formatStep(i, s, 800)),
        "",
        hits.length ? "Most relevant moments:" : "No step matched the question's words; read the work with anydock_read_work instead.",
        ...blocks,
        "",
        `Answer from these steps and cite them like [12]. If they don't settle it, say so and suggest asking ${who(work)}.`,
      ].join("\n");
    },
  },
];

async function shareOrHandover(kind: "share" | "handover", a: { to: string; note?: string; session?: string }): Promise<string> {
  const s = currentSession(a.session);
  const synced = await authorizeAndSync(s);
  const r = await api<{ share: { toUserId: string | null } }>("POST", `/api/works/${synced.workId}/${kind}`, { to: a.to, note: a.note });
  const verb = kind === "handover" ? "Handed over" : "Shared";
  return [
    `${verb} "${s.title}" (${s.source} session ${s.sessionId.slice(0, 8)}, ${synced.stepCount} steps) with ${a.to}.`,
    r.share.toUserId ? "They'll see it in their AnyDock inbox now." : `${a.to} isn't on AnyDock yet; it will be waiting when they sign in with that email.`,
    `New progress in this session keeps syncing to them while \`anydock watch\` runs. Work id: ${synced.workId}`,
  ].join("\n");
}

// ---------- JSON-RPC over stdio ----------

type Msg = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: any };

const send = (m: object) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");

async function handle(msg: Msg): Promise<void> {
  const { id, method, params } = msg;
  const reply = (result: unknown) => id !== undefined && send({ id, result });
  const fail = (code: number, message: string) => id !== undefined && send({ id, error: { code, message } });

  switch (method) {
    case "initialize":
      return void reply({
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "anydock", title: "AnyDock", version: VERSION },
        instructions:
          "AnyDock moves agent work between teammates. Use anydock_share / anydock_handover when the user wants to send this session's work to someone; anydock_inbox to see what teammates sent; anydock_read_work and anydock_ask_why to understand a teammate's work.",
      });
    case "ping":
      return void reply({});
    case "tools/list":
      return void reply({ tools: tools.map(({ run: _run, ...t }) => t) });
    case "tools/call": {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) return void fail(-32602, `Unknown tool: ${params?.name}`);
      if (!loadConfig().token) {
        return void reply({ content: [{ type: "text", text: "AnyDock isn't signed in on this machine. Ask the user to run: anydock login" }], isError: true });
      }
      try {
        const text = await tool.run(params?.arguments ?? {});
        return void reply({ content: [{ type: "text", text }] });
      } catch (e) {
        const message =
          e instanceof ApiError && e.status === 404 ? "Not found, or you don't have access to it." : e instanceof Error ? e.message : String(e);
        return void reply({ content: [{ type: "text", text: `AnyDock error: ${message}` }], isError: true });
      }
    }
    default:
      if (method?.startsWith("notifications/")) return; // e.g. notifications/initialized
      return void fail(-32601, `Method not found: ${method}`);
  }
}

export function serveMcp(): Promise<void> {
  // stdout is the protocol channel; send stray logs to stderr.
  console.log = (...args: unknown[]) => console.error(...args);
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg: Msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return void send({ id: null, error: { code: -32700, message: "Parse error" } });
    }
    handle(msg).catch((e) => send({ id: msg.id ?? null, error: { code: -32603, message: String(e) } }));
  });
  return new Promise((r) => rl.on("close", r));
}
