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
  - **Live sync**: watches session files; new steps appear in the local UI immediately and, for authorized sessions, upload incrementally so recipients see progress live (pushed via a per-user Durable Object WebSocket).
  - **Self-update**: the CLI is bundled into one JS file served from `anydock.ai`. On start (and daily while running) it checks the latest version; if newer, it downloads it, replaces itself and restarts the background service. Install via `curl -fsSL https://anydock.ai/install.sh | sh`.
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

## Repo layout

- `server/` — Cloudflare Worker (`anydock`): Hono + Better Auth on D1.
  - `src/index.ts` routes · `src/auth.ts` Better Auth config (shared with the schema generator) · `src/pages.ts` sign-in and device-approval pages · `src/email.ts` Primitive sender (logs the email when unconfigured).
  - `src/works.ts` Works API · `src/hub.ts` `UserHub` Durable Object (live push) · `src/types.ts` shared types.
  - `migrations/0001_auth.sql` is **generated** (`npm run gen:auth-schema`) — regenerate after changing auth plugins, never hand-edit. `0002_anydock.sql` holds our tables: `project`, `projectMember`, `work`, `share`, `inboxItem`; `0003_assignee.sql` adds `work.assigneeId/assigneeEmail`.
  - Test: `test/e2e.mjs` — two/three-user end-to-end run against `wrangler dev` (`npm run test:e2e -- dev.log`). Run it after server changes.
  - Cloudflare account `7f1052dd81e37b78c2c47fdaa53533a9`; D1 `anydock-v2`; R2 `anydock-trajectories`.
  - Dev: `cd server && npx wrangler d1 migrations apply anydock-v2 --local && npx wrangler dev` (secrets in `server/.dev.vars`, gitignored). `dev.host` is pinned to localhost because the `anydock.ai` route would otherwise make auth reject local requests.
  - **Deploy: `cd server && npm run deploy`** — builds the CLI bundle into `public/cli/` (gitignored), applies remote D1 migrations, deploys the Worker on `anydock.ai`. Static files in `public/` (`install.sh`, `cli/anydock.mjs`, `cli/version.json`) are served before the Worker.
- `cli/` — the `anydock` CLI. Zero runtime dependencies (Node 26: built-in fetch, WebSocket, recursive fs.watch, parseArgs); runs `src/main.ts` directly. Dev: `cd cli && npm link`, or `node cli/src/main.ts …`.
  - `src/sources/claude.ts`, `codex.ts` parse transcripts into the shared `Step` shape (`src/sources/types.ts`); `discover.ts` lists files, caches parses by mtime, and applies redaction (`src/redact.ts`) to everything that may upload.
  - `src/config.ts` — `~/.anydock/config.json` (server, token; mode 0600) and `state.json` (sync rules). `src/sync.ts` — idempotent upload (server `stepCount` is the source of truth) and the `watch` loop. `src/login.ts` — device flow.
  - Distribution: `npm run build` (cli) bundles `src/main.ts` with esbuild into one file and writes `version.json` (`build` = Unix seconds, `sha256`). `install.sh` installs into `~/.anydock/bin` (`anydock.mjs` + an `anydock` launcher pinning the node path) and puts it on PATH. `src/version.ts` holds VERSION/BUILD (build 0 = dev, never self-updates) and the command agents should launch. `src/update.ts`: `anydock update`; `watch` auto-updates every 6h and re-execs; `mcp` updates the file in the background for next launch.
  - One-step onboarding: `install.sh` ends with `exec anydock setup` (`src/setup.ts`: sign in if needed → `mcp install` → `service install`; idempotent). `ANYDOCK_NO_SETUP=1` installs only — that's what `/agents.md` (the "one prompt" path: *"Set up AnyDock for me: follow https://anydock.ai/agents.md"*) tells agents to use before running the steps themselves. `src/service.ts`: background `watch` via launchd (`ai.anydock.watch`, log `~/.anydock/watch.log`) or a systemd user unit; `anydock service install|uninstall|status`.
  - Env overrides for tests: `ANYDOCK_HOME`, `ANYDOCK_SERVER`, `ANYDOCK_CLAUDE_ROOT`, `ANYDOCK_CODEX_HOME`, `ANYDOCK_NO_BROWSER` (tests must set it so login never opens a real browser).
  - `src/mcp.ts` — `anydock mcp`, a stdio MCP server (hand-rolled JSON-RPC, no SDK). Tools: `anydock_share`, `anydock_handover` (default to the *current* session: newest session of the launching agent whose cwd, compared by real path, equals the MCP's cwd; sharing also adds a sync rule), `anydock_inbox`, `anydock_list_works`, `anydock_read_work` (numbered, clipped, paged), `anydock_ask_why` (lexical retrieval of relevant steps + original goal; the calling agent writes the answer and cites `[n]`). `src/install.ts` — `anydock mcp install|uninstall` for Claude Code (`claude mcp add --scope user`) and Codex (`~/.codex/config.toml`).
  - Tests: `node cli/test/e2e.mjs <server dev.log>` (CLI), `node cli/test/mcp-e2e.mjs <server dev.log>` (MCP over stdio, two users), `npm run build && node cli/test/setup-e2e.mjs <server dev.log>` (the one-line install in a temp HOME; on macOS registers a real launchd job and removes it). After a build, wait a few seconds: `wrangler dev` reloads and can drop log lines. Synthetic transcripts in temp dirs; never touch real sessions or real agent config.
- `tasks/` — self-contained task briefs for another agent (e.g. `tasks/oauth-setup.md` for Codex).
- `SETUP.md` — manual account steps (OAuth apps, Primitive, secrets). Agents never create accounts or handle these secrets.

## Conventions

- TypeScript run directly by Node 26 / bundled by wrangler: use explicit `.ts` extensions in relative imports.
- Better Auth is built per request (Workers bindings are per request).
- Auth endpoints live under `/api/auth/*`. The CLI signs in with the device flow (`client_id` `anydock-cli`) and then sends `Authorization: Bearer <token>`.

## Server API (all under `/api`, auth by session cookie or `Authorization: Bearer`)

| Method & path | What it does | Who |
|---|---|---|
| `PUT /works` | Upsert my work for one agent session (`source` + `sessionId`); returns it with `role` | anyone signed in |
| `GET /works` | Mine, assigned to me, shared with me, via my projects; each with `role` | — |
| `GET /works/:id` | One work | anyone with access |
| `PUT /works/:id/steps` | Live sync: `{fromIndex, steps}`; overlap is fine, a gap returns `409 {stepCount}` | owner |
| `GET /works/:id/steps?from=&limit=` | Read the trajectory | anyone with access |
| `POST /works/:id/share` · `/handover` | `{to: email, note}`. Works before the recipient has an account (bound on their first sign-in). Handover sets the assignee | owner or assignee |
| `GET /works/:id/shares` · `DELETE /shares/:id` | List / revoke shares | owner/assignee · creator or owner |
| `GET /inbox?unread=1` · `POST /inbox/:id/read` | Shares, handovers (later: questions) | — |
| `GET /live` (WebSocket) | Events `inbox.new`, `work.updated`; CLI passes `?token=` | — |

Access rules: **owner** (uploads, created it) · **assignee** (current responsible person after a handover) · **shared** (explicit share, until revoked) · **project** (member of the linked project and `visibility = project`). Missing and forbidden both return 404. Raw trajectories live in R2 at `works/<id>/trajectory.json`.

## Status

- [x] Repo created, dependencies installed
- [x] Server auth: email code, GitHub, Google (both enabled only when their secrets are set), CLI device login + bearer tokens; `/login`, `/device`, `/api/me`. Verified locally with email code and device flow.
- [x] D1 tables (auth + AnyDock domain), created locally; remote D1 and R2 created but not migrated yet.
- [ ] Not deployed yet — blocked on SETUP.md steps 1–4.
- [x] Works API: upload + live step sync, list/get, share, handover (incl. to people without accounts), revoke, inbox, live push over WebSocket. `test/e2e.mjs` passes locally (21 checks).
- [x] CLI: `login` (device flow) / `logout` / `whoami`, `sessions` (Claude Code + Codex), `sync <id>` / `sync --dir`, `unsync`, `rules`, `watch` (live incremental upload + live inbox events). Nothing uploads without a rule; secrets redacted; meta/injected text dropped. `cli/test/e2e.mjs` passes (18 checks).
- [x] AnyDock MCP for Claude Code and Codex: share, handover, inbox, list works, read a work's trajectory, ask why. `cli/test/mcp-e2e.mjs` passes (23 checks).
- [x] **Live at https://anydock.ai** (deployed Oct 17): home page with install command, login + device pages, API, `curl -fsSL https://anydock.ai/install.sh | sh`, self-updating CLI. Remote D1 migrated, `BETTER_AUTH_SECRET` set.
- [ ] Production sign-in remains pending (SETUP.md 1–3). Oct 17: reused GitHub OAuth app 3892579, corrected callback to `/api/auth/callback/github`, saved `GITHUB_CLIENT_ID` in Cloudflare; client secret still missing. Google AnyDock project `western-pivot-512023-a8` created under `qizi297@gmail.com`; branding saved after explicitly authorized User Data Policy acceptance, test user added; `AnyDock web` client created by user and both Google credentials saved in Cloudflare. Live Google button reaches the correct account chooser/scopes/callback; full session verification awaits Google Touch ID/passkey authentication. GitHub button remains disabled until its secret is provided. Email sender is also missing; sign-in codes only appear in `cd server && npx wrangler tail`.
- [ ] Not yet installed into Nolan's real Claude Code / Codex config (`anydock mcp install`).
- [ ] Next candidates: deploy, localhost UI, distill (summary + method), delegate actions (Slack / email / call) + permission panel, self-update bundle.

## Open questions

- Passkey sign-in: deferred until the core flow works (Better Auth passkey plugin).
- Manufact track ("best MCP server", mcp-use): the local MCP is hand-rolled to keep the CLI dependency-free. To compete there, add a remote mcp-use server on the Worker exposing the same read-side tools.
- Armature analytics SDK requires MCP SDK 1.x; mcp-use v2 uses SDK v2 — check compatibility before targeting both tracks.
