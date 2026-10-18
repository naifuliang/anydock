import { createInterface } from "node:readline";
import { api, ApiError } from "./api.ts";
import { loadConfig, loadState, saveState } from "./config.ts";
import { listSessionFiles, parseSession } from "./sources/discover.ts";
import type { ParsedSession, Source, Step } from "./sources/types.ts";
import { syncSession } from "./sync.ts";
import { askOnThisMac, nativeApprovalPossible } from "./native/approve.ts";
import { VERSION } from "./version.ts";
import { watchForUpdates } from "./update.ts";
import { currentSession, launchingAgent, maybeCurrentSession } from "./session.ts";
import { artifactUrl, createArtifact, listArtifacts, readArtifact, resolveId, shareArtifact, signInLink, uploadArtifact, writeArtifact } from "./artifacts.ts";
import { openInViewer } from "./native/viewer.ts";

// `anydock mcp`: a stdio MCP server that Claude Code and Codex launch. Agents use it to share or hand over
// the session they are in, see what teammates sent them, read a teammate's trajectory, and ask why.
// Plain newline-delimited JSON-RPC 2.0 — no SDK, so the CLI stays dependency-free.


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
    name: "anydock_organizations",
    description: "List the AnyDock organizations you belong to. Organization membership controls access to shared Manufact servers.",
    inputSchema: {type:"object",properties:{}}, annotations:{readOnlyHint:true},
    run: async () => JSON.stringify(await api("GET","/api/organizations")),
  },
  {
    name: "anydock_manufact_servers",
    description: "List only the Manufact servers your AnyDock organization permits you to inspect. Never returns provider credentials.",
    inputSchema: {type:"object",properties:{organizationId:{type:"string"}},required:["organizationId"]}, annotations:{readOnlyHint:true},
    run: async a => {const d=await api("GET","/api/organizations/"+encodeURIComponent(a.organizationId));return JSON.stringify({connected:d.connected,servers:d.resources});},
  },
  {
    name: "anydock_manufact_server",
    description: "Read the current status of one authorized Manufact server through AnyDock.",
    inputSchema: {type:"object",properties:{organizationId:{type:"string"},serverId:{type:"string"}},required:["organizationId","serverId"]}, annotations:{readOnlyHint:true,openWorldHint:true},
    run: async a => JSON.stringify(await api("GET","/api/organizations/"+encodeURIComponent(a.organizationId)+"/manufact/servers/"+encodeURIComponent(a.serverId))),
  },
  {
    name: "anydock_manufact_redeploy",
    description: "Request redeployment of an existing Manufact server. AnyDock checks organization and server permissions, records the request, and requires administrator approval unless explicitly allowed. Pending is not deployed; check requests later. Failed/uncertain outcomes must be checked in Manufact before requesting again.",
    inputSchema: {type:"object",properties:{organizationId:{type:"string"},serverId:{type:"string"},requestKey:{type:"string",description:"A fresh UUID for this intended deployment; reuse exactly this key when retrying the same request so it cannot deploy twice."},branch:{type:"string"}},required:["organizationId","serverId","requestKey"]}, annotations:{readOnlyHint:false,destructiveHint:true,openWorldHint:true},
    run: async a => JSON.stringify(await api("POST","/api/organizations/"+encodeURIComponent(a.organizationId)+"/requests",{serverId:a.serverId,requestKey:a.requestKey,...(a.branch?{branch:a.branch}:{})})),
  },
  {
    name: "anydock_organization_requests",
    description: "Check deployment request and approval status for an AnyDock organization. Members see their own requests; administrators see the organization queue.",
    inputSchema: {type:"object",properties:{organizationId:{type:"string"}},required:["organizationId"]}, annotations:{readOnlyHint:true},
    run: async a => JSON.stringify(await api("GET","/api/organizations/"+encodeURIComponent(a.organizationId)+"/requests")),
  },
  {
    name: "anydock_share",
    description:
      "Share the work in this agent session with a teammate by email (they get it in their AnyDock inbox and their agent can read the trajectory and ask why). Uploads the session, and keeps syncing new progress to them.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Teammate's name (e.g. \"Jason\", if you've worked together) or email address" },
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
        to: { type: "string", description: "Teammate's name (e.g. \"Jason\", if you've worked together) or email address" },
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
  {
    name: "anydock_slack_post",
    description:
      "Post a Slack message AS THE USER (their own Slack account), to a channel like \"#launch\" or to a teammate's email (as a DM). AnyDock checks the user's rule first: it may run at once, ask the user to approve, or be blocked. Use when the user asks you to tell / message / ping someone in Slack.",
    inputSchema: {
      type: "object",
      properties: { to: { type: "string", description: '"#channel" or a teammate\'s email' }, text: { type: "string", description: "The message, written as the user would" } },
      required: ["to", "text"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (a) => delegateAction("slack.post", { to: a.to, text: a.text }),
  },
  {
    name: "anydock_email",
    description:
      "Send an email on the user's behalf (replies go to the user). Emails to the user's own company domain follow their 'email teammates' rule; anyone else follows 'email outside the team' (usually: ask the user first).",
    inputSchema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string", description: "Plain-text body" } },
      required: ["to", "subject", "body"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (a) => delegateAction("email", { to: a.to, subject: a.subject, body: a.body }),
  },
  {
    name: "anydock_text",
    description:
      "Text a person (iMessage/SMS) on the user's behalf, e.g. to tell the teammate you handed work to that it's urgent. `to` is a phone number in +1… format or a teammate's email (uses the phone they saved in AnyDock). Usually needs the user's approval.",
    inputSchema: {
      type: "object",
      properties: { to: { type: "string", description: "+14155550123 or teammate@company.com" }, text: { type: "string", description: "Short message (≤1600 chars)" } },
      required: ["to", "text"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    run: (a) => delegateAction("text", { to: a.to, text: a.text }),
  },
  {
    name: "anydock_action_status",
    description: "Check an AnyDock action that was waiting for the user's approval (id from anydock_slack_post / anydock_email).",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) {
      const { action } = await api<{ action: Act }>("GET", `/api/actions/${a.id}`);
      return describeAction(action);
    },
  },

  // ---------- artifacts (same core as `anydock artifact …`) ----------
  {
    name: "anydock_artifact_create",
    description:
      "Create a live document, slide deck, spreadsheet, LaTeX document or web page the user and teammates can open, co-edit, share and hand over. " +
      "For docs and decks, lay down the skeleton first: pass `outline` (one entry per section/slide, \"Heading: what goes here\"), then fill sections one by one with anydock_artifact_write so the user watches it come together. " +
      "Pass `content` instead to create it in one go (Markdown for doc/slides, CSV for sheet, source for latex/html). For apps, Office files, PDFs or images use anydock_artifact_upload.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        type: { type: "string", enum: ["doc", "slides", "sheet", "latex", "html"] },
        outline: { type: "array", items: { type: "string" }, description: "Sections (doc) or slides (slides), e.g. [\"# Launch plan: one-line goal\", \"Timeline: key dates\", \"Risks\"]. A leading # makes a top-level heading." },
        content: { type: "string", description: "Full content instead of an outline." },
      },
      required: ["title", "type"],
    },
    annotations: { openWorldHint: true },
    run: (a) => createArtifact(a),
  },
  {
    name: "anydock_artifact_write",
    description:
      "Write into an artifact: fill or rewrite one section/slide (by number or heading), add a new one (section=\"new\" with heading, optionally after=<section>), or replace everything (section=\"all\"). " +
      "Sheets take CSV (or TSV) for a tab; latex/html take the full source. Sections someone is editing are locked — pick another and come back.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        section: { type: "string", description: "Section number (1-based) or heading; \"new\" to add; \"all\" to replace the whole thing." },
        content: { type: "string", description: "Markdown for the section body (no heading line), CSV for sheets, full source for latex/html." },
        heading: { type: "string", description: "Rename the section, or the heading of a new one." },
        after: { type: "string", description: "With section=\"new\": insert after this section (number or heading)." },
      },
      required: ["id", "content"],
    },
    annotations: { openWorldHint: true },
    async run(a) { return writeArtifact({ ...a, id: await resolveId(a.id) }); },
  },
  {
    name: "anydock_artifact_read",
    description: "Read an artifact (yours, shared with you, or attached to a work you can see): Markdown for docs/decks, CSV for sheets, source for LaTeX/HTML, the file list otherwise. Optionally one section.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "Artifact id, unique prefix, or exact title." }, section: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: true, openWorldHint: true },
    async run(a) { return readArtifact(await resolveId(a.id), a.section); },
  },
  {
    name: "anydock_artifact_upload",
    description:
      "Publish a local file or folder as an artifact (or a new version of one with `id`). A folder with index.html becomes a running app (sandboxed, on its own origin); " +
      ".docx/.pptx/.xlsx/.pdf/images are kept as-is with versions and previewed in the browser (the user can turn Office files into live docs/decks/sheets); " +
      ".md/.csv/.tex/.html become live, co-editable artifacts.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "Absolute or relative path." }, id: { type: "string", description: "Upload as a new version of this artifact." }, title: { type: "string" } }, required: ["path"] },
    annotations: { openWorldHint: true },
    async run(a) { return uploadArtifact({ path: a.path, title: a.title, id: a.id ? await resolveId(a.id) : undefined }); },
  },
  {
    name: "anydock_artifact_list",
    description: "List artifacts you own, that were shared with you, or that belong to works you can see.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: () => listArtifacts(),
  },
  {
    name: "anydock_artifact_share",
    description: "Share an artifact with a teammate by email (editor by default, or viewer), or hand it over (they become the owner with its history; you keep edit access). It lands in their AnyDock inbox.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, to: { type: "string", description: "Teammate's name or email" }, role: { type: "string", enum: ["editor", "viewer"] }, handover: { type: "boolean" }, note: { type: "string" } },
      required: ["id", "to"],
    },
    annotations: { openWorldHint: true },
    async run(a) { return shareArtifact({ ...a, id: await resolveId(a.id) }); },
  },
  {
    name: "anydock_permissions",
    description:
      "What this agent session may do right now through AnyDock: for each action, allowed / ask the user / blocked — the user's rules, narrowed or widened for this session only. " +
      "Pass restrict=[actions] to tighten this session yourself (e.g. a research-only session that must not email anyone); only the user can loosen it.",
    inputSchema: {
      type: "object",
      properties: { restrict: { type: "array", items: { type: "string", enum: ["slack.post", "email.internal", "email.external", "phone.text"] } }, to: { type: "string", enum: ["ask", "deny"], description: "With restrict: ask (default) or deny." } },
    },
    annotations: { openWorldHint: true },
    async run(a) {
      const s = maybeCurrentSession();
      if (a.restrict?.length) {
        if (!s) return "Can't tell which session this is, so nothing was changed.";
        for (const action of a.restrict) await api("PUT", "/api/sessions/rule", { ...s, action, decision: a.to === "deny" ? "deny" : "ask" });
      }
      const q = s ? `?source=${encodeURIComponent(s.source)}&sessionId=${encodeURIComponent(s.sessionId)}` : "";
      const { actions } = await api<{ actions: Record<string, { label: string; decision: string; person: string; bySession: boolean }> }>("GET", `/api/sessions/effective${q}`);
      const word = { allow: "allowed", ask: "asks the user first", deny: "blocked" } as Record<string, string>;
      return [s ? `This ${s.source} session (${s.sessionId.slice(0, 8)}):` : "This agent (session unknown — the user's rules apply):",
        ...Object.values(actions).map((x) => `- ${x.label}: ${word[x.decision]}${x.bySession ? ` (this session; the user's rule: ${word[x.person]})` : ""}`)].join("\n");
    },
  },
  {
    name: "anydock_app_grant",
    description:
      "Give an app (an AnyDock artifact of type app or html) some of YOUR permissions so it can act through AnyDock — e.g. post in Slack, email, text. " +
      "Permissions only narrow: you can give only what the user's rules let you do, optionally limited to certain recipients (`to`) and for a number of days. " +
      "Granting always needs the user's approval (Touch ID / password on their Mac, the dashboard or Slack). The app then calls window.anydock.call(...) from its page or backend; it never sees a token.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The app artifact (id, prefix or exact title)." },
        actions: { type: "array", items: { type: "string", enum: ["slack.post", "email.internal", "email.external", "phone.text"] } },
        days: { type: "number", description: "How long (1–30, default 7)." },
        to: { type: "array", items: { type: "string" }, description: "Optional: only these Slack channels / people / email addresses / phone numbers." },
      },
      required: ["id", "actions"],
    },
    annotations: { openWorldHint: true },
    async run(a) { return delegateAction("app.grant", { artifactId: await resolveId(a.id), actions: a.actions, days: a.days ?? 7, ...(a.to?.length ? { to: a.to } : {}) }); },
  },
  {
    name: "anydock_artifact_open",
    description:
      "Show an artifact to the user. where=\"builtin\" (use this when you have a built-in browser, e.g. the Claude or Codex desktop app): returns a one-time link that signs your browser in — open it there and bring the browser panel to the front. " +
      "where=\"window\" (default when you have no browser): on a Mac, a native window already signed in; elsewhere, the default browser.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, where: { type: "string", enum: ["builtin", "window"] } }, required: ["id"] },
    async run(a) {
      const id = await resolveId(a.id);
      if (a.where === "builtin") return `Open this in your built-in browser now (one-time, signs it in, valid 2 minutes), then bring the browser panel to the front: ${await signInLink(`/a/${id}`)}`;
      const { url, title } = await artifactUrl(id);
      const how = openInViewer(url, title);
      return how === "window" ? `Opened "${title}" in an AnyDock window on the user's Mac.` : `Opened ${url} in the user's browser.`;
    },
  },
];

// ---------- delegate ----------

interface Act {
  id: string;
  userId: string;
  sessionId?: string | null;
  status: "pending" | "approved" | "denied" | "blocked" | "executed" | "failed";
  summary: string;
  decidedVia?: string | null;
  result?: { detail?: string } | null;
  approveUrl?: string;
}

function describeAction(a: Act): string {
  switch (a.status) {
    case "executed":
      return `Done. ${a.result?.detail ?? a.summary}`;
    case "failed":
      return `It was allowed but failed: ${a.result?.detail ?? "unknown error"}`;
    case "blocked":
      return `Not done: the user's AnyDock rule blocks this ("${a.summary}"). They can change it at anydock.ai/app → Permissions.`;
    case "denied":
      return `The user denied it${a.decidedVia ? ` (in ${a.decidedVia})` : ""}. Don't retry unless they ask.`;
    case "pending":
      return `Waiting for the user's approval: "${a.summary}". Only they can approve it: Touch ID / password on their Mac, the AnyDock dashboard (Inbox), or the Slack DM. Check again with anydock_action_status id=${a.id}.`;
    default:
      return `Status: ${a.status}.`;
  }
}

export async function delegateAction(action: "slack.post" | "email" | "text" | "app.grant", payload: Record<string, unknown>): Promise<string> {
  let act: Act;
  try {
    // Say which agent session is asking: rules can differ per session, and approvals can be "for this session".
    ({ action: act } = await api<{ action: Act }>("POST", "/api/actions", { action, payload, agent: launchingAgent() ?? "agent", session: maybeCurrentSession() }));
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && (e.data as any)?.action) return describeAction((e.data as any).action);
    if (e instanceof ApiError && (e.data as any)?.message) return `Not done: ${(e.data as any).message}`;
    throw e;
  }
  if (act.status !== "pending") return describeAction(act);

  // Best: the native Mac panel. Approving needs the Mac's owner (Touch ID / Watch / login password), which an agent
  // driving the screen can't provide. If the user decides elsewhere first, the panel closes.
  if (nativeApprovalPossible()) {
    const ctrl = new AbortController();
    const elsewhere = (async () => {
      while (!ctrl.signal.aborted) {
        await new Promise((r) => setTimeout(r, 2000));
        const { action: cur } = await api<{ action: Act }>("GET", `/api/actions/${act.id}`).catch(() => ({ action: act }));
        if (cur.status !== "pending") { ctrl.abort(); return cur; }
      }
      return null;
    })();
    // The panel signs exactly what the server will check (server/src/trust.ts), so the signature can't be reused.
    const message = `anydock-approve:v1\n${act.id}\n${act.userId}\n${act.summary}`;
    const sessionMessage = act.sessionId && action !== "app.grant" ? `anydock-approve-session:v1\n${act.id}\n${act.userId}\n${act.summary}` : undefined;
    const local = await askOnThisMac({ summary: act.summary, message, sessionMessage, agent: launchingAgent() ?? "agent", timeoutSec: 120, signal: ctrl.signal });
    const decidedElsewhere = ctrl.signal.aborted ? await elsewhere : null;
    ctrl.abort();
    if (decidedElsewhere) return describeAction(decidedElsewhere);
    if (local.verdict === "approve" || local.verdict === "approve-session" || local.verdict === "deny") {
      const body = local.verdict === "deny" ? { approve: false, via: "mac" } : { approve: true, signature: local.signature, scope: local.verdict === "approve-session" ? "session" : "once" };
      const { action: decided } = await api<{ action: Act }>("POST", `/api/actions/${act.id}/decide`, body);
      return describeAction(decided);
    }
    if (local.verdict === "timeout") return describeAction(act);
    // "unavailable": fall through to waiting for the dashboard or Slack.
  }

  // This token can't approve anything itself (agents never can), so wait a little for the person to decide in the
  // dashboard or Slack, then hand back the id.
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const { action: cur } = await api<{ action: Act }>("GET", `/api/actions/${act.id}`);
    if (cur.status !== "pending") return describeAction(cur);
  }
  return describeAction(act);
}

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

type Msg = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: any; result?: any; error?: any };

const send = (m: object) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");

async function handle(msg: Msg): Promise<void> {
  const { id, method, params } = msg;
  const reply = (result: unknown) => id !== undefined && send({ id, result });
  const fail = (code: number, message: string) => id !== undefined && send({ id, error: { code, message } });

  switch (method) {
    case "initialize":
      return void reply({
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: true } }, // a reloaded server tells the client to re-list tools
        serverInfo: { name: "anydock", title: "AnyDock", version: VERSION },
        instructions:
          "AnyDock moves agent work between teammates. Use anydock_share / anydock_handover when the user wants to send this session's work to someone; anydock_inbox to see what teammates sent; anydock_read_work and anydock_ask_why to understand a teammate's work; anydock_slack_post and anydock_email to message people as the user (their rules decide: done, needs approval, or blocked). When the user wants a document, deck, spreadsheet, page or small app that teammates can open, edit or take over, make it an AnyDock artifact (anydock_artifact_create: skeleton first, then fill section by section; anydock_artifact_upload for files and apps) and show it to them: in your built-in browser via the one-time sign-in link it returns (then bring the browser panel to the front), or with anydock_artifact_open.",
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
  let inflight = 0;
  let reloadWanted = false;
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let msg: Msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return void send({ id: null, error: { code: -32700, message: "Parse error" } });
    }
    inflight++;
    handle(msg)
      .catch((e) => send({ id: msg.id ?? null, error: { code: -32603, message: String(e) } }))
      .finally(() => { inflight--; if (reloadWanted) setTimeout(reload, 50); });
  });

  // Stay current without the agent restarting us: when a new version is installed, wait until nothing is in flight
  // and nothing is buffered, then exec the new code on the same stdin/stdout. The client's session carries on (MCP over
  // stdio holds no other state); the new process tells it to re-list tools so new ones appear.
  const reload = () => {
    reloadWanted = true;
    if (inflight > 0 || process.stdin.readableLength > 0 || process.stdout.writableLength > 0) return;
    const execve = (process as unknown as { execve?: (file: string, args: string[], env: NodeJS.ProcessEnv) => never }).execve;
    if (!execve) return;
    rl.pause();
    process.stdin.pause();
    execve(process.execPath, [process.execPath, ...process.argv.slice(1)], { ...process.env, ANYDOCK_MCP_RELOADED: VERSION });
  };
  watchForUpdates(reload);
  if (process.env.ANYDOCK_MCP_RELOADED) {
    console.error(`AnyDock MCP reloaded: ${process.env.ANYDOCK_MCP_RELOADED} → ${VERSION}`);
    send({ method: "notifications/tools/list_changed" });
  }
  return new Promise((r) => rl.on("close", r));
}
