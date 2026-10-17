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

**"Git for work, not just code."** We are the system of record for work: every piece of work — done by a human or an agent — keeps its context, trajectory, permissions and environment, so anyone (or any agent) can pick it up.

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

## Core concepts

- **Work** — the unit of work. Fields: goal, artifacts, trajectory (steps, sources, decisions with rationale), open questions, access needed (grant references, never raw tokens), runtime pointer, assignees.
- **Seat** (vision only, not in demo) — a role: standing access, responsibilities, ongoing Work, agents it sponsors. Hiring an agent = a seat with no human in it.
- **Verbs**: `share`, `handover`, `ask` (why/where-from on any claim), later `delegate`, `hire`, `revoke`.

## Demo story (draft)

1. Hook: "At my internship I spent all day copy-pasting between Slack and Claude. Am I the agent, or is it?"
2. Nolan, in **Claude Code**, makes a competitor report: agent reads team Slack + web, posts the report to Slack.
3. Instead of booking a meeting to teach Jason: `share with Jason`.
4. Jason, in **Codex** (different vendor), says "do what Nolan did, for competitor C". His agent runs Nolan's method using **Jason's own permissions**.
5. A judge asks "why did you do it this way?" — the agent answers from Nolan's trajectory.
6. "The meeting that never happened." Vision slide: org graph + work graph; sponsors as the pipes below.

## Architecture (planned)

- **Capture**: local client reads agent transcripts — Claude Code `~/.claude/projects/<cwd-slug>/<session>.jsonl`, Codex `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; both support hooks.
- **Distill**: trajectory → Work (summary, decisions, sources, reusable method). Initially via `claude -p` headless (no API key needed).
- **Serve**: MCP server (mcp-use, for the Manufact track) exposing share / handover / ask / get-method.
- **Surface**: Slack app (Bolt, Socket Mode).
- Stack: Node 26 + TypeScript, Hono, mcp-use v2, zod, @slack/bolt.

## Status

- [x] Repo created, dependencies installed
- [ ] Everything else — not started

## Open questions

- Product name (placeholder: `relay`).
- Demo task: competitor report, or a real workflow from Nolan's internship?
- Storage: local SQLite first vs InsForge/Supabase (sponsor tracks).
- Armature analytics SDK requires MCP SDK 1.x; mcp-use v2 uses SDK v2 — check compatibility before targeting both tracks.
