# AGENTS.md

Single source of truth for every agent (Claude Code, Codex, Cursor, …) and human working in this repo.
We are vendor-neutral, so project knowledge lives here — not in a vendor-specific file.

## Rules for agents

1. **Read this file first.** It holds the product thesis, decisions, architecture and current status.
2. **Keep it current.** When a decision is made, scope changes, a convention is set, or a component lands, update the relevant section here in the same change.
3. **Always commit.** Commit every meaningful change to git with a clear message (and push when a remote exists). Never leave work uncommitted at the end of a task.
4. **Build only what is asked.** The human drives scope step by step; don't run ahead on unrequested features.
5. Record open questions in the "Open questions" section instead of guessing.

## Context

- Event: YC "Make Something Agents Want" hackathon, YC SF, Oct 17–18, 2026. Submissions + live demos due **Oct 18, 10:00 AM**.
- Sponsors / tracks: Primitive (agent communication), Stripe (agent economy), Manufact (best MCP server), Inkbox (agent identity), InsForge (agent-native cloud), Armature (agent experience / evals), Blaxel ("something a human would never want"), Supabase.
- Hackathon reality: **aha moment and narrative matter most.** Optimize the demo story, not completeness.

## Thesis

**One-liner: "Agents made individuals 10x. AnyDock makes teams 10x."**

Positioning line: **"Git for work, not just code."** We are the system of record for work: every piece of work — done by a human or an agent — keeps its context, trajectory, permissions and environment, so anyone (or any agent) can pick it up.

Two pains, one product:

| Pain | Essence |
|---|---|
| **Human glue** — agents can't reach company SaaS (Slack, GitHub, Notion…), so humans copy-paste between tools and agents. "Am I the agent, or is it?" | **Access in**: permissions should flow into agents along the org structure, configured once — not per person × per agent × per SaaS. |
| **Teaching meetings** — after doing a task with my agent, I still hold a meeting to teach a colleague how to do it; they then re-teach their own agent. | **Know-how out**: a trajectory should compile into something a colleague's agent can run and explain. |

Why now: decisions used to live in a human head (you could ask them). Now agents make them inside sessions that disappear — nobody, not even the person, remembers why.

Positioning:
- Everyone builds *multiplayer* AI (watch each other's Claude). Companies need **relay**: async handoff of work across people and agents.
- **Neutral layer**: works across Claude Code, Codex, and other agents. Vendor memory only works inside one vendor.
- We own the **org graph** (humans, agents, who an agent works for) and the **work graph** (context, trajectory, artifacts, decisions). We integrate everything else (connectors, sandboxes, identity, payments) from existing providers.
- First customers: AI-native small teams (like YC startups). Enterprise later.

Taglines: "The person leaves. The work doesn't." · "Stop teaching people. Teach their agents." · "The meeting that never happened."

## The three verbs (demo + pitch spine)

| Verb | Pain | In the product |
|---|---|---|
| **delegate** | Human glue (access in) | Dock MCP + permission panel: the agent acts within *your* permissions (Slack message, email, phone call…) |
| **share** | "Where did this come from?", teaching meetings (know-how out) | Share a trajectory; the recipient's agent can ask *why* and replay the method |
| **handover** | Work stopped mid-way | "Hand over to Ashley": context, progress and access move together |

"Delegate lets agents in, share lets know-how out, handover keeps work going."
Vision only: **hire** an agent = a seat with no human in it.

## Core concepts

- **Work** — the unit of work. Fields: goal, artifacts, trajectory (steps, sources, decisions with rationale), open questions, access needed (grant references, never raw tokens), runtime pointer, assignees.
- **Seat** (vision only) — a role: standing access, responsibilities, ongoing Work, agents it sponsors.
- **Visibility** — every session is **Private** by default (local only). **Project**: you link a local project to a team project, its trajectories auto-sync, members can see them. **Shared**: you explicitly share one Work with a person. Nobody can see anything you haven't shared or synced.

## Demo story

Scenario: **this very hackathon** — Nolan researched the 8 sponsors with Claude Code and chose what to build. Real trajectory, and the judges are the sponsors.

1. Hook: "At my internship I spent all day copy-pasting between Slack and Claude. Am I the agent, or is it?"
2. Open Dock App: this morning's sponsor-research session is listed.
3. **share**: in Claude Code, "share this research with Jason" → Jason gets a Slack notification.
4. Jason, in **Codex** (different vendor): "use Nolan's method to research next month's YC hackathon sponsors" → his agent replays the method.
5. Main aha: a judge (e.g. from Primitive) asks "why did you pick our track?" — answered from today's real trajectory.
6. **handover** to a judge: their phone gets an iMessage (Inkbox): "Nolan handed this to you, reply with any question." They reply; the agent answers.
7. **delegate**: the agent tries to call someone; the permission panel says "ask me" → approval pops up → call goes out.
8. Close: "Agents made individuals 10x. AnyDock makes teams 10x." / "The person leaves. The work doesn't."

## Architecture

- **Local client (Dock App)** — background service + local web UI on `localhost` (native menubar app later).
  - Discovers all local sessions: Claude Code `~/.claude/projects/<cwd-slug>/<session>.jsonl`, Codex `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
  - Normalizes both into one trajectory format; distills via the user's own agent (`claude -p` / `codex exec`), so no API key is needed and raw data stays local.
  - Syncs only what the user authorized (project link or explicit share); redacts secrets before upload.
- **Dock MCP** — installed into Claude Code and Codex. Context tools (share, handover, attach session to project, ask, get method) and action tools (Slack message, email via Primitive, call / iMessage via Inkbox), all gated by the permission panel (allow / ask me / deny).
- **Cloud** — Cloudflare Workers on `anydock.ai`: D1 for Works, users, permissions; R2 for raw trajectories; Slack app; web views.
- Stack: Node 26 + TypeScript, Hono, mcp-use v2, zod, @slack/bolt.

## Build order

- **Phase 1 — context (must)**: local service + session list → distill into Work → cloud storage with share/handover → Dock MCP (share, handover, ask, get method).
- **Phase 2 — access (minimum)**: Slack DM + channel read → permission panel with at least one "ask me" action and approval → Inkbox iMessage/call on handover.
- **Phase 3 — polish**: project auto-sync, Primitive email, web "blame" view (click a sentence → its source step).
- **Minimum demo** = Phase 1 + Slack notification + one "ask me" action in the permission panel.

## Decisions log

- Product name: **AnyDock** everywhere — domain `anydock.ai`, GitHub repo `naifuliang/anydock`, npm package and CLI command `anydock` (e.g. `anydock login`, `anydock app`, `anydock mcp`). The local folder is still `relay/`.
- Cloud: Cloudflare (existing account and domain). Old AnyDock worker deleted Oct 17; old D1/R2/KV kept; old code archived at `naifuliang/anydock-legacy`.
- Local client ships as a local web UI first.
- Demo scenario: the sponsor-research session from this hackathon.

## Status

- [x] Repo created, dependencies installed
- [ ] Phase 1 — not started

## Open questions

- Auth method(s) for the server (email / Google / GitHub / passkey).
- Armature analytics SDK requires MCP SDK 1.x; mcp-use v2 uses SDK v2 — check compatibility before targeting both tracks.
