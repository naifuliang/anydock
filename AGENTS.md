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

- Event: YC "Make Something Agents Want" hackathon, YC SF, Oct 17–18, 2026. Submission due **Oct 18, 10:00 AM**: a 2-minute video, GitHub/code repository link, and a two-sentence description. Organizers will share the submission link in the morning and select a subset of teams for 2-minute live demos (YC chat, Oct 17).
- Sponsors / tracks: Primitive (agent communication), Stripe (agent economy), Manufact (best MCP server), Inkbox (agent identity), InsForge (agent-native cloud), Armature (agent experience / evals), Blaxel ("something a human would never want"), Supabase.
- **Submission (Oct 18):** two sentences — "Agents made you 10x. AnyDock — GitHub for your agents' work — makes your team 10x." Video script, cast, continuity: `DEMO.md`; production (Codex): `tasks/video-production.md`. Repo goes public at submission.
- Hackathon reality: **aha moment and narrative matter most.** Optimize the demo story, not completeness.

## Thesis

**One-liner: "Agents made you 10x. AnyDock — GitHub for your agents' work — makes your team 10x."**

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

Scenario: **this very hackathon** — Nolan researched the 8 sponsors with Claude Code and chose what to build. Use the real trajectory in a team-operated demo recorded as a 2-minute video. No judge accounts, judge onboarding, or judge participation are needed.

1. Hook: "At my internship I spent all day copy-pasting between Slack and Claude. Am I the agent, or is it?"
2. Open Dock App: this morning's sponsor-research session is listed.
3. **share**: in Claude Code, "share this research with Jason" → Jason gets a Slack notification.
4. Jason, in **Codex** (different vendor): "use Nolan's method to research next month's YC hackathon sponsors" → his agent replays the method.
5. Main aha: we ask "why did we pick the Primitive track?" — answered from today's real trajectory, with source citations.
6. **handover** to a teammate/demo account we control: show context and progress moving together. If Inkbox is ready, demonstrate a message on Nolan's own phone; otherwise keep this step in AnyDock. No judge interaction.
7. **delegate**: the agent tries to call someone; the permission panel says "ask me" → approval pops up → call goes out.
8. Close: "Agents made individuals 10x. AnyDock makes teams 10x." / "The person leaves. The work doesn't."

## Architecture

- **Local client (Dock App)** — background service + local web UI on `localhost` (native menubar app later).
  - Discovers all local sessions: Claude Code `~/.claude/projects/<cwd-slug>/<session>.jsonl`, Codex `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl` (`CODEX_HOME` defaults to `~/.codex`; `ANYDOCK_CODEX_HOME` overrides for tests).
  - Normalizes both into one trajectory format; distills via the user's own agent (`claude -p` / `codex exec`), so no API key is needed and raw data stays local.
  - Syncs only what the user authorized (project link or explicit share); redacts secrets before upload.
  - **Live sync**: watches session files; new steps appear in the local UI immediately and, for authorized sessions, upload incrementally so recipients see progress live (pushed via a per-user Durable Object WebSocket).
  - **Self-update**: the CLI is bundled into one JS file served from `anydock.ai`. On start (and daily while running) it checks the latest version; if newer, it downloads it, replaces itself and restarts the background service. Install via `curl -fsSL https://anydock.ai/install.sh | sh`.
- **Dock MCP** — installed into Claude Code and Codex. Context tools (share, handover, attach session to project, ask, get method) and action tools (Slack message, email via a connected Gmail/Outlook mailbox, call / iMessage via Inkbox), all gated by the permission panel (allow / ask me / deny).
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
- Demo scenario: the sponsor-research session from this hackathon. Oct 17 update: prioritize our own recorded 2-minute demo; no judge accounts or judge participation. Additional Google test users are deferred at Nolan's request.

## Repo layout

- `server/` — Cloudflare Worker (`anydock`): Hono + Better Auth on D1.
  - `src/index.ts` routes · `src/auth.ts` Better Auth config (shared with the schema generator) · `src/pages.ts` sign-in and device-approval pages · `src/email.ts` Cloudflare own-domain system sender (production fails closed when unconfigured).
  - Design: **white, minimal** (Nolan's call — no dark theme on the landing page). Geist + Geist Mono, Instrument Serif italic for display words, near-black text, one blue accent `#2b59ff`. The dashboard uses the same fonts and accent.
  - **AnyDock mark** (Oct 18, Nolan picked concept B2 "handoff"): the blue piece of work handed on top of the next one. Single source `public/img/icon.svg` (tab icon; dark piece turns light in dark mode, gap is a mask cutout) → `LOGO` in `src/landing.ts` (nav/sign-in, dark piece = currentColor), `icon-tile.svg` (white tile) → `icon.png` 512, `apple-touch-icon.png` 180; `icon-32.png` and `public/favicon.ico` (PNG) for browsers that skip SVG. Every page links all three. Rasterize with AppKit (masks render jagged there, so the tile uses a white stroke instead of a mask).
  - Icons: `src/icons.ts` (generated, inline SVG) — brand marks from Simple Icons (`brand(k)`), line icons from Lucide (`line(k)`). Codex (LobeHub icons, MIT), Slack and VS Code (Iconify "logos", CC0) are multi-color SVGs in `RAW`; use `logo(k)` for any mark. Don't hand-draw brand logos.
  - Illustrations: slots render a dotted placeholder until `server/public/img/<file>` exists (no code change to swap in). Brief for an image agent: `tasks/image-generation.md` (14 use-case images + `og.png` + `icon.png`).
  - Landing connectors include a "Plugs into your SSO" group (Okta, Microsoft Entra ID, Google Workspace, SCIM — coming soon). Positioning (Oct 17): AnyDock plugs into existing SSO/IdPs as the org-chart source; it is not "Agent SSO" — it adds the work, permission and approval layer on top.
  - Landing content: no founder quotes. Problem = 9 "human as glue" pains (incl. connector N×M, pasted tokens, access not moving with the work).
  - `src/landing.ts` the landing page at `/` (hero **carousel** in `src/hero.ts` — 8 slides, each with its own staged animation (`data-t` = seconds after the slide activates; CSS defines the effect): Trace a report, Hand over, Team status, Message for me, Skip the meeting, Onboard, Connect once, Pass the keys; autoplay 9s, tabs/arrows/dots, starts when visible, works-with logos, problem `GLUE`, three verbs, use-case **carousel** `CASES` with role filter, "Ask why" product shot, features `FEATURES` (live/soon), comparison `COMPARE`, **connectors grid** — `CONNECTOR_GROUPS`, each `live: true|false`; flip to true as integrations ship — and the permission-panel preview). `src/app.ts` the signed-in dashboard at `/app`, styled like the landing page (light only): sidebar grouped Work / Team / Trust with Lucide icons + badges, a copy-the-setup-prompt card and live status. Hash routes: `#/` Overview (greeting, stats, continue, latest from teammates, setup checklist, approvals waiting), `#/works` (searchable table), `#/inbox`, `#/w/:id` trajectory viewer (ask why, live steps, share / handover, pick-up prompt, project), `#/projects`, `#/p/:id` (members, Discord), `#/permissions` (rules, connected tools, activity timeline), `#/settings` Integrations grid. `src/projects.ts` Projects API.
  - `src/discord.ts` Discord connector: per-project channel links (`discordLink`, migration 0004), bot-install OAuth with an HMAC-signed state (no table), channel picker, `notifyDiscord()` on share / handover / link-to-project, and `POST /api/discord/interactions` (Ed25519-verified) for `/anydock why` and `/anydock recent`. Slash commands are bulk-registered on each successful connect. Switches on when `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` exist (`GET /api/discord/status`). `DISCORD_API` overrides the API base for tests. `src/rank.ts` shared lexical step ranking.
  - Test: `test/discord-e2e.mjs` runs against a mock Discord on :8799; local `.dev.vars` must carry the test values documented at the top of that file (`test/discord-test-key.json` is a TEST-ONLY key).
  - `src/delegate.ts` delegate: `ACTIONS` catalog with defaults, `policy` rules, `POST /api/actions` (agent asks → allow runs now / ask creates a pending request + notifies / deny blocks 403), `POST /api/actions/:id/decide` (first decision wins, from dashboard / agent / Slack), Slack OAuth v2 (bot token for approval DMs + the person's user token), Slack interactions (signing-secret verified; the clicker must own the request). Tokens AES-GCM encrypted in `connection` (`src/secure.ts`). Migration 0005: `connection`, `policy`, `actionRequest` (= approval queue + audit log). `SLACK_API` overrides the API base for tests.
  - Test: `test/delegate-e2e.mjs` (mock Slack on :8798; `.dev.vars` needs the test values in its header). CLI: `cli/test/mcp-delegate-e2e.mjs` (elicitation approve/decline, dashboard approval while the tool waits, blocked).
  - `src/mailbox.ts` "email as you": Gmail / Outlook OAuth (`/api/connectors/{gmail,outlook}/start|callback`, DELETE), encrypted refresh token in `connection`, `sendAsUser()` (Gmail raw RFC822 / Graph sendMail). Delegate email tries the person's mailbox first, then Primitive. `GOOGLE_OAUTH_URL`, `GOOGLE_TOKEN_URL`, `GMAIL_API`, `MS_LOGIN_URL`, `MS_GRAPH_API` override endpoints for tests.
  - `src/inkbox.ts` texts via Inkbox (iMessage from the identity, SMS fallback from the number), `GET/PUT /api/me/profile` (`phone` E.164, `textOnHandover`; migration 0006 `profile`), handover texts. `INKBOX_API` overrides the base for tests.
  - **Artifacts** (Oct 18; Nolan: "must have — share, co-edit, hand over, permissions, every common format"): `src/artifacts.ts` API, `src/artifact-page.ts` the page at `/a/:id` (one page, a view per kind), `src/room.ts` `ArtifactRoom` Durable Object (live edits + presence), migration 0010.
    - Kinds: **doc** / **slides** = live sectioned Markdown (skeleton first: sections start `todo` with a brief, agents fill them one by one and they animate in live; per-section locks so people and agents edit different sections at once; export .md/.docx/.pptx/PDF); **sheet** = live grid (own grid, formulas SUM/AVERAGE/MIN/MAX/COUNT + arithmetic, per-cell edits with optimistic retry, presence per cell, .xlsx/.csv import/export via SheetJS); **latex** (source + live latex.js preview + compiled PDF if uploaded); **html** (source + live preview); **app** (a folder with index.html, versioned, runs on `USERCONTENT_ORIGIN` = `https://u.anydock.ai` — a different site, so apps can't use anydock.ai cookies; the main host refuses `/u/`); **file** (Word via docx-preview, PowerPoint via our own JSZip renderer, Excel via SheetJS, PDF, images; "Edit as a live doc/deck/sheet" converts docx/pptx/xlsx/md).
    - Access: owner · `artifactShare` (editor/viewer, by email, bound on sign-in) · its Work (owner/assignee edit, shared/project view) — so a work's handover moves its artifacts. Artifact handover makes the recipient the owner (previous owner keeps edit). Artifacts made in an agent session carry `source`/`sessionId` and join that session's Work when it syncs. Inbox items `artifact.share` / `artifact.handover`. History in `artifactEvent` (person vs agent).
    - Uploaded files are served from the app origin only as downloads-safe (`application/octet-stream` for HTML/JS/SVG, CSP sandbox). Libraries load from jsdelivr at view time (marked, DOMPurify, docx-preview, SheetJS, mammoth, turndown, html-to-docx, pptxgenjs, latex.js, JSZip).
    - Tests: `test/artifacts-e2e.mjs` (39 checks).
  - **App backends + narrowing permissions** (Oct 18; Nolan: "from the top down, permissions only shrink; only what the agent itself holds can be given to an app, and granting is itself a permission that needs the person"): `src/apps.ts`, `src/sandbox.ts`, migration 0011.
    - Every app (kind app/html) gets, on its content origin under `/u/<id>/<capability>/`: `_anydock.js` (SDK `window.anydock`), `_api/data/<collection>[/<key>]` (shared JSON store, 64 KB/value, 5000 values), `_api/call` (+ `_api/call/<id>` to poll), `_api/grants`, and `_backend/*` (its own server code).
    - **Chain person → agent → app.** New action `app.grant` ("Let an app act for you", default ask, can never be set to allow). An agent asks with `POST /api/actions {action:"app.grant", payload:{artifactId, actions, days, to?}}` → it waits for the person (Mac panel signature, Inbox, Slack); a person granting from their own browser is the approver (applies at once). Only actions the grantor holds can be given (rule ≠ deny), only `GRANTABLE` real actions (never `app.grant`). `appGrant` rows: scope (`to` list), expiry (≤30 days), `grantorSessionId`.
    - **Every app call re-checks the chain:** grant not revoked/expired, the granting agent's login still exists (signing it out kills its grants), recipient in scope, then the person's *current* rule (allow → runs, ask → waits in their Inbox labelled `app: <title>`, deny → blocked). Runs through the same `requestAction`/`execute` as agent actions; audited in `actionRequest`. Apps never see tokens or user ids. Revoke: `DELETE /api/artifacts/:id/grants/:gid` (anyone who can edit). List: `GET /api/artifacts/:id/grants`.
    - **Default runtime: Cloudflare Containers** (Nolan, Oct 18: our own paid plan). `src/container.ts` `AppContainer` (Durable Object + container, `basic` instance, max 10) runs the public image `docker.io/library/node:22-slim` — no image build, no Docker to deploy; a bootstrap (`node -e`) downloads the app's files from a signed bundle URL (`_bundle/<version>/<hmac>`, removed from the backend's env), `npm install`s if there's a package.json, starts `server.js` / `npm start` on $PORT; sleeps after 10 idle minutes, wakes on the next request. Verified live Oct 18: cold ≈3 s, warm ≈0.7 s. Local dev disables containers (`dev.enable_containers: false`) and tests use the Blaxel mock (`APP_RUNTIME=blaxel` in `.dev.vars`). `APP_RUNTIME=blaxel` switches production to Blaxel.
    - **Backend runtime is swappable** (`SandboxRuntime` in `src/sandbox.ts`): Blaxel adapter (sponsor) — `POST api.blaxel.ai/v0/sandboxes?createIfNotExist=true` (image `blaxel/base-image:latest`, port 3000), files via `PUT <sandbox>/filesystem/{path}` (multipart), `npm install` if package.json, `POST <sandbox>/process` (`node server.js` / `npm start`, `waitForPorts`), requests proxied by AnyDock to `<sandbox>/port/3000/…` with `X-Blaxel-Authorization` (no public URL). The backend gets `ANYDOCK_APP_URL` (its capability URL) and calls `_api/*` like the page — same grants, no token. Switches on with secrets `BLAXEL_API_KEY` + `BLAXEL_WORKSPACE` (Codex: `tasks/blaxel-setup.md`); without them `_backend` answers 503. `BLAXEL_API` overrides the control plane for tests.
    - Agents: `anydock_app_grant` / `anydock artifact grant <app> slack.post,… [--to] [--days]`; the skill explains the SDK, backends and grants. Artifact page: an app's side panel lists grants (who, via agent, scope, expiry), Revoke, "+ Give permission".
    - **Public links** (Oct 24, Nolan: "support public — anyone, including outside people; agents can open it; needs the fingerprint by default"): migration 0013 (`artifact.publicToken/publicAt`). `/p/<token>` renders the artifact page read-only for anyone, no sign-in (signed-in visitors are sent to `/a/:id`); its reads go to `GET /api/artifacts/:id[/files/*|/versions|/text]?pt=<token>` — the only routes that work without a session, view only, and the response hides shares, history, the work and the link itself. `POST /api/artifacts/:id/public {on}`: on = owner in the browser (immediate; agents get 403 `needs_approval`), off = anyone who can edit, agents included (it only narrows). Agents ask with action `artifact.publish` ("Make an artifact public") — **always asks, and asks twice** (Oct 25, Nolan: "approve plus a pop-up, a double confirmation"): in `ALWAYS_ASK` (no rule or "This session" can pre-allow it) and in `CONFIRM_TWICE`: the Mac panel shows a "Make it public?" dialog before Touch ID and then signs `anydock-approve-confirmed:v1\n…` — the server accepts only that signature for it (a plain one-time signature is refused); the dashboard asks in a confirm dialog; the Slack Approve button carries Slack's confirm dialog via `anydock_artifact_publish` / `anydock artifact publish <id> [--off]`; the result carries `publicUrl`. Share panel: "Public link" on/off + copy. Tests in `test/agent-trust-e2e.mjs`.
    - **Deleting artifacts.** Owners delete in the browser (artifact page → Share → Delete). Agent tokens can't `DELETE /api/artifacts/:id` (HUMAN_ONLY); they ask with action `artifact.delete` (`anydock_artifact_delete` / `anydock artifact delete <id>`): their own artifact → always asks (Touch ID / Inbox / Slack), never pre-allowed by a rule or "This session" (`ALWAYS_ASK` = `app.grant`, `artifact.delete`); someone else's → 403 `forbidden` at once, nobody is asked.
    - Test: `test/apps-e2e.mjs` (30 checks; mock Blaxel on :8796, `.dev.vars` values in its header).
  - **Approvals are one-time by default** (Oct 25, Nolan): every action's default rule is **ask** (spend / push to main stay deny). An approval has a scope — **once** (the default button everywhere) · **this session** for 15 min or 8 h (only that agent session; `sessionRule.expiresAt`) · **always** (saves a standing `policy` allow for all the person's agents). "More ▾" in the dashboard / Inbox / approval pop-up and "More" in the Mac panel hold the session and always options. **"Always" is never one click**: the dashboard arms it on the first click (red, "Click again…") and applies on the second; the Mac panel shows a confirmation dialog before Touch ID and signs `anydock-approve-always:v1\n…` — the server verifies scope-specific signatures, so a once/session signature can't be replayed as always. Setting a rule to Allow in Permissions also needs a second click. `POST /actions/:id/decide {scope: once|session|always, minutes?}`. Not offered for `ALWAYS_ASK` actions. All earlier authorizations (session allows, app grants, rules) on the two demo accounts were revoked Oct 25.
  - **Per agent session permissions** (Oct 18; Nolan: "authorization for each agent session"): migration 0012 (`sessionRule`; `actionRequest.source/sessionId/cliSessionId`).
    - The MCP / CLI sends `session {source, sessionId}` with each action (ignored unless the caller is an agent token). `effectiveDecision()` = the person's rule, then that session's rule: ask/deny only narrow; `allow` exists only if the person gave it (approving **"This session"** — Mac panel button, Inbox/popup button, Slack "Allow for this session" — or the dashboard), lasts 8 h, may be scoped (`to`), never beats the person's deny, never applies to `app.grant`. Recorded `decidedVia: "… · this session"` / `"session rule"`.
    - Mac panel signs `anydock-approve-session:v1\n…` for "This session" (vs `anydock-approve:v1\n…` once), so one kind of approval can't be replayed as the other.
    - API: `GET /api/sessions` (sessions seen in 7 days: device, linked work, own rules), `GET /api/sessions/effective?source&sessionId`, `PUT /api/sessions/rule` (agents may only set ask/deny = narrow; allow / inherit is the person's), `DELETE /api/sessions/rules?…` (person only: "Back to my rules"). Dashboard Permissions → "Agent sessions". MCP `anydock_permissions` (see / restrict this session).
    - Note: the session id is reported by the local MCP, so it scopes and narrows within one person's own agents; the hard boundary stays agent tokens + signed approvals.
    - Test: `test/sessions-e2e.mjs` (19 checks).
  - `src/people.ts` recipients by name: share / handover / artifact share accept "Jason" as well as an email, resolved among people you already work with (shares either way, project and organization co-members, work owners/assignees); ambiguous or unknown names return a clear 400. Test: `test/people-e2e.mjs`.
  - `src/trust.ts` agent vs person (see "Agent tokens" below); test `test/agent-trust-e2e.mjs`.
  - Tests: `test/mail-text-e2e.mjs` (mock Google/Microsoft/Inkbox on :8797; test values in its header) and `test/client-syntax.mjs` (syntax-checks the dashboard/landing inline scripts — run after editing `app.ts`/`landing.ts`; a quoting slip there blanks the page).
  - `src/works.ts` Works API · `src/hub.ts` `UserHub` Durable Object (live push) · `src/types.ts` shared types.
  - `migrations/0001_auth.sql` is **generated** (`npm run gen:auth-schema`) — regenerate after changing auth plugins, never hand-edit. `0002_anydock.sql` holds our tables: `project`, `projectMember`, `work`, `share`, `inboxItem`; `0003_assignee.sql` adds `work.assigneeId/assigneeEmail`.
  - Test: `test/e2e.mjs` — two/three-user end-to-end run against `wrangler dev` (`npm run test:e2e -- dev.log`). Run it after server changes.
  - Cloudflare account `7f1052dd81e37b78c2c47fdaa53533a9`; D1 `anydock-v2`; R2 `anydock-trajectories`.
  - Dev: `cd server && npx wrangler d1 migrations apply anydock-v2 --local && npx wrangler dev` (secrets in `server/.dev.vars`, gitignored). `dev.host` is pinned to localhost because the `anydock.ai` route would otherwise make auth reject local requests.
  - **Deploy: `cd server && npm run deploy`** — builds the CLI bundle into `public/cli/` (gitignored), applies remote D1 migrations, deploys the Worker on `anydock.ai`. Static files in `public/` (`install.sh`, `cli/anydock.mjs`, `cli/version.json`) are served before the Worker.
- `cli/` — the `anydock` CLI. Zero runtime dependencies (Node 26: built-in fetch, WebSocket, recursive fs.watch, parseArgs); runs `src/main.ts` directly. Dev: `cd cli && npm link`, or `node cli/src/main.ts …`.
  - `src/sources/claude.ts`, `codex.ts` parse transcripts into the shared `Step` shape (`src/sources/types.ts`); `discover.ts` lists files, caches parses by mtime, and applies redaction (`src/redact.ts`) to everything that may upload.
  - `src/config.ts` — `~/.anydock/config.json` (server, token; mode 0600) and `state.json` (sync rules). `src/sync.ts` — idempotent upload (server `stepCount` is the source of truth) and the `watch` loop. `src/login.ts` — device flow.
  - Distribution: `npm run build` (cli) bundles `src/main.ts` with esbuild into one file and writes `version.json` (`build` = Unix seconds, `sha256`). `install.sh` installs into `~/.anydock/bin` (`anydock.mjs` + an `anydock` launcher pinning the node path) and puts it on PATH. `src/version.ts` holds VERSION/BUILD (build 0 = dev, never self-updates) and the command agents should launch. `src/update.ts` (Oct 18, Nolan: "the client should auto-update"): `anydock update`; `watch` checks every 15 min and re-execs; the **MCP server reloads itself in place** — when a new build is installed (by itself or another AnyDock process) and nothing is in flight or buffered, it execs the new code on the same stdin/stdout, then sends `notifications/tools/list_changed` (it declares `tools.listChanged`), so agents get new tools without a restart. Once per new build a detached `anydock _after-update` refreshes the skill files and pre-builds the native Mac helpers (marker `~/.anydock/applied-build`). Test: `cli/test/update-e2e.mjs` (two real builds; older one upgrades mid-session).
  - Node: `install.sh` uses the system Node if it is 22+, otherwise downloads the newest official LTS from nodejs.org into `~/.anydock/node` (SHASUMS256-verified, no sudo) and pins it in the launcher; it only asks the user when that fails (`ANYDOCK_FORCE_NODE_DOWNLOAD=1` forces the download for testing). Agents never need to ask about Node. One-step onboarding: `install.sh` ends with `exec anydock setup` (`src/setup.ts`: sign in if needed → `mcp install` → `service install`; idempotent). `ANYDOCK_NO_SETUP=1` installs only — that's what `/agents.md` (the "one prompt" path: *"Set up AnyDock for me: follow https://anydock.ai/agents.md"*) tells agents to use before running the steps themselves. `src/service.ts`: background `watch` via launchd (`ai.anydock.watch`, log `~/.anydock/watch.log`) or a systemd user unit; `anydock service install|uninstall|status`.
  - Env overrides for tests: `ANYDOCK_HOME`, `ANYDOCK_SERVER`, `ANYDOCK_CLAUDE_ROOT`, `ANYDOCK_CODEX_HOME`, `ANYDOCK_NO_BROWSER` (tests must set it so login never opens a real browser).
  - `src/mcp.ts` — `anydock mcp`, a stdio MCP server (hand-rolled JSON-RPC, no SDK). Tools: `anydock_artifact_create|write|read|upload|list|share|open` (artifacts), `anydock_share`, `anydock_handover` (default to the *current* session: newest session of the launching agent whose cwd, compared by real path, equals the MCP's cwd; sharing also adds a sync rule), `anydock_inbox`, `anydock_list_works`, `anydock_read_work` (numbered, clipped, paged), `anydock_ask_why` (lexical retrieval of relevant steps + original goal; the calling agent writes the answer and cites `[n]`), and delegate tools `anydock_slack_post`, `anydock_email`, `anydock_text`, `anydock_action_status` (on "ask me": on macOS the native panel — Touch ID or Mac password — while also watching for a decision elsewhere; else MCP elicitation if the client supports it; else wait ≤50s for an approval elsewhere, then return the id). `src/native/approve.ts` compiles the SwiftUI panel (`approve-swift.ts`) once with `xcrun swiftc` into an app bundle `~/.anydock/apps/approve-<hash>/AnyDock.app` (`src/native/bundle.ts`, see below); `anydock setup` pre-builds it. `ANYDOCK_NO_NATIVE_APPROVAL=1` disables it (all tests set it). `src/install.ts` — `anydock mcp install|uninstall` for Claude Code (`claude mcp add --scope user`) and Codex (`~/.codex/config.toml`).
  - Tests: `node cli/test/e2e.mjs <server dev.log>` (CLI), `node cli/test/mcp-e2e.mjs <server dev.log>` (MCP over stdio, two users), `npm run build && node cli/test/setup-e2e.mjs <server dev.log>` (the one-line install in a temp HOME; on macOS registers a real launchd job and removes it). After a build, wait a few seconds: `wrangler dev` reloads and can drop log lines. Synthetic transcripts in temp dirs; never touch real sessions or real agent config.
  - Artifacts for agents — **both MCP and CLI, same core** (`src/artifacts.ts`; Nolan: "support both, use whichever fits"): `anydock artifact create|write|read|upload|list|share|open` and `anydock open <id>`. Text options take values starting with "-" literally (Markdown bullets). `src/session.ts` finds the current agent session (used to attach artifacts to its Work).
  - **Skill** (`src/skill.ts`): `anydock mcp install` (so setup / the one-line install) also writes `~/.claude/skills/anydock/SKILL.md` and `~/.codex/skills/anydock/SKILL.md`: skeleton first → show it in the host's built-in browser (Claude/Codex desktop) or `anydock open` → fill section by section; formats; MCP and CLI equivalents.
  - **Built-in browsers** (Oct 18, Nolan: the pane opened hidden and signed out): `POST /api/sign-in-link {next}` returns a one-time link (`/l/<token>?next=`, Better Auth `oneTimeToken`, hashed, single use, 2 min, server-side generation only) that signs a browser in **as the caller's session** — an agent's link gives an agent session (can view/edit artifacts, can't approve). Artifact create/upload results include one; `anydock_artifact_open where=builtin` / `anydock open <id> --link` mint another. The skill tells agents to open it and bring the browser pane to the front. Tested in `server/test/agent-trust-e2e.mjs` and `cli/test/artifacts-e2e.mjs`.
  - **Native Mac apps are real bundles** (Oct 18, Nolan: no icon on the window or in the Dock): `src/native/bundle.ts` builds `~/.anydock/apps/<kind>-<hash>/AnyDock.app` — swiftc binary, Info.plist (name "AnyDock", `ai.anydock.viewer` / `ai.anydock.approve`), `AnyDock.icns` made with `sips` + `iconutil` from the embedded mark (`src/native/icon-png.ts`, regenerate from `server/public/img/icon.png` if the logo changes), ad-hoc `codesign`; old builds are removed. The viewer shows in the Dock / menu bar / ⌘-Tab as AnyDock; the approval panel stays out of the Dock (`LSUIElement`) but its header and the Touch ID dialog show the AnyDock icon. The Keychain helper stays a bare binary (its identity anchors the Keychain item's access list).
  - **Mac viewer window** (`src/native/viewer*.ts`, `anydock open`): WKWebView app compiled once with swiftc; loads the artifact page signed in with this Mac's CLI token (stdin → `window.__ANYDOCK_TOKEN`, Authorization on page loads), downloads to ~/Downloads, full-screen present, real Edit menu. Elsewhere `anydock open` uses the default browser. Test: `cli/test/artifacts-e2e.mjs` (24 checks).
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
| `POST /projects` · `GET /projects` · `GET /projects/:id` | Create; list mine (with member/work counts); detail with members + linked works | member |
| `POST /projects/:id/members` · `DELETE /projects/:id/members/:userId` | Add by email (needs an existing account) · remove (owner) or leave | member · owner |
| `PUT /works/:id/project` | `{projectId \| null}` — link/unlink; sets visibility `project` (or back to `shared`/`private`) | owner |
| `GET /live` (WebSocket) | Events `inbox.new`, `work.updated`; CLI passes `?token=` | — |

Access rules: **owner** (uploads, created it) · **assignee** (current responsible person after a handover) · **shared** (explicit share, until revoked) · **project** (member of the linked project and `visibility = project`). Missing and forbidden both return 404. Raw trajectories live in R2 at `works/<id>/trajectory.json`.

## Integrations status (keep current)

| Integration | State | Next step / owner |
|---|---|---|
| Claude Code, Codex | Live: session capture + MCP (auto-registered by `anydock mcp install`) | — |
| Cursor, Windsurf, VS Code | MCP config documented in `/agents.md`; **not yet tested** | Codex: `tasks/mcp-clients-qa.md` |
| GitHub / Google sign-in | Live (Google in Testing: listed test users only) | Codex: `tasks/google-access-and-email.md` |
| Email sign-in codes (Cloudflare) | Live: existing Workers Paid plan, restricted login@anydock.ai binding; domain mail delivered | Production auth OTP inbox receipt verified |
| Discord | Live in private AnyDock demo: #general connection embed and /anydock recent response verified Oct 18 | Populated work/why scenarios not covered by this smoke test |
| Slack (delegate: post as you + approval DMs) | New app installed with explicit approval; self-DM delivery verified | Human Slack approval-button check remains optional |
| Organization communication resources (Primitive) | Account and credit ready; not a platform mail fallback | Organization-scoped Primitive connector remains to implement |
| Email as you: Gmail / Outlook (Proton: no public OAuth send API → "coming soon") | **Code done** + tested with mocks (`src/mailbox.ts`); Gmail reuses the Google OAuth client (needs `gmail.send` scope on the consent screen), Outlook needs `MS_CLIENT_ID/SECRET` | Codex: `tasks/email-accounts-setup.md` |
| Armature (MCP analytics) | Workspace/key ready, 1,000 monthly credits | Live instrumentation not built |
| Manufact (hosted MCP) | Free server and organization connector live; real permission/approval/revocation verified | `tasks/manufact-setup.md` |
| Phone / SMS / iMessage (Inkbox) | **Code done** + tested with a mock (`src/inkbox.ts`): `anydock_text` (rule "Text a person", default ask me), opt-in handover texts. Needs `INKBOX_API_KEY` + `INKBOX_IDENTITY_ID` and/or `INKBOX_PHONE_NUMBER_ID` | Codex: `tasks/inkbox-setup.md` |
| Delegate core (permission rules, approvals, audit) | **Live**: rules panel, activity log, approvals in dashboard (live toast), in-agent (MCP elicitation) and Slack DM buttons | — |
| Blaxel (app backends in sandboxes) | Scoped secrets configured; real provider Node 24 REST smoke passed and test sandbox deleted | Artifact-to-runtime application test remains; see `tasks/blaxel-setup.md` |
| GitHub repo access, Notion, Linear, Drive, Stripe, Okta | Roadmap ("Coming soon" on landing) | — |

**Codex works from `tasks/RUNBOOK.md`** — the ordered list of every account-setup task, shared rules, and a progress table.

Approval design (agreed, Oct 17): who asks and who approves decide how we interrupt.
- Your own agent, on your machine, while you're there → **native macOS approval panel** (SwiftUI, animated) shown by the
  MCP process (`cli/src/native/`), approved with **Touch ID or the Mac login password** (LocalAuthentication
  `.deviceOwnerAuthentication` — Nolan's call: biometrics or password, anything the agent doesn't have) so an agent doing
  computer use can't click "approve" for you; the approval is a Secure Enclave signature the server verifies. Falls back to the dashboard / Slack where the panel isn't available.
- Your own agent in the background (you may be away) → system notification + Inbox + Slack DM; no modal.
- Someone else's agent asking you (e.g. over their budget) → **no pop-up**: it waits in your Inbox and Slack.
- Inbox is "everything waiting for you": "Needs your decision" (approvals) first, then "From teammates"; one badge.
- Not built yet: approver ≠ requester (subordinate asks a superior) and passkey-gated dashboard approvals.

Agent tokens (Oct 18, Nolan: "the agent must not be able to decode or one-line the token"):
- **The token is an agent token, by design.** Any program running as the same OS user can ask AnyDock to act, so the
  boundary is what the token *can do*, enforced on the server (`server/src/trust.ts`): every session created by the CLI
  device flow is recorded in `agentSession`; such sessions can request and deny actions but get `403 human_required` for
  approving, rules (`PUT /delegate/policy`), connecting tools, profile, project members / Discord links, organization
  admin and decisions, and all Better Auth endpoints except `get-session` / `sign-out` (so an agent can't approve a new
  device login and mint itself a key).
- **Approving from an agent token needs a device signature.** At sign-in the CLI creates a Secure Enclave P-256 key
  (`.privateKeyUsage + .userPresence`; the file `~/.anydock/approval-key` is an opaque blob only that Mac's Secure
  Enclave can use) and sends the public key with `/device/token`; it is enrolled for that session only, because the person
  approved that login in the browser (`approvalKey`, migration 0009). The panel signs
  `anydock-approve:v1\n{id}\n{userId}\n{summary}` after Touch ID / password; the server verifies it against its own
  record (WebCrypto ECDSA, raw r||s). Browser sessions approve as `dashboard`; Slack buttons stay signing-secret verified.
- **Token at rest is never plain text** (`cli/src/secret.ts`): macOS Keychain via the `anydock-keychain-<hash>` helper
  (items trust only that binary; `security find-generic-password` prompts the person), Linux Secret Service via
  `secret-tool`, otherwise an AES-256-GCM file (`token.enc`, key from a separate salt + uid + machine-id). `config.json`
  holds only `tokenStore`. The keychain / keyring entry is per AnyDock home (the real `~/.anydock` uses the server URL as account; any other `ANYDOCK_HOME` appends `#<home>`), so two identities on one Mac (e.g. the demo's Nolan + Jason) never share a token — found by Codex Oct 18. Tests use the file store (`ANYDOCK_NO_NATIVE_APPROVAL` / `ANYDOCK_TOKEN_STORE=file`).
- MCP elicitation approvals were removed (an agent token can't approve); off-Mac the tool waits for the dashboard / Slack.
- Residual risks (not solved yet): an agent with computer use clicking Approve in a signed-in dashboard (→ passkey-gated
  dashboard approvals), or approving a device login in the browser.

Delegate design (agreed direction): agents never see third-party tokens. A person connects a tool once in the dashboard;
AnyDock stores the token server-side, and MCP tools like `anydock_slack_post` are executed by the server after checking
that person's rules (allow / ask me / deny; defaults: read own-access = allow, message teammates = allow, outside the
team / calls = ask me, spend / destructive = deny). "Ask me" reaches the person in-session (harness tool prompt, MCP
elicitation where supported) or async (dashboard live toast, Slack/Discord DM with Approve/Deny); every action is audited.

## Status

- [x] Hero carousel avatars generated and deployed (Oct 17): six fictional teammate portraits in `server/public/img/avatars/`, 512×512 WebP, 12–20 KB each. Checked at 28px, verified live hero rendering and all six production files against local bytes.

- [x] All 16 landing images generated and deployed (Oct 17): 14 use-case WebP illustrations at 1600×1000 (21–78 KB each), 1200×630 social preview and 512×512 icon. Live carousel visually verified; all 16 production assets match local files. Brief: `tasks/image-generation.md`.

- [x] Repo created, dependencies installed
- [x] Server auth: email code, GitHub, Google (both enabled only when their secrets are set), CLI device login + bearer tokens; `/login`, `/device`, `/api/me`. Verified locally with email code and device flow.
- [x] D1 tables (auth + AnyDock domain) created locally and remote migrations applied; remote D1 and R2 created.
- [x] Works API: upload + live step sync, list/get, share, handover (incl. to people without accounts), revoke, inbox, live push over WebSocket. `test/e2e.mjs` passes locally (21 checks).
- [x] CLI: `login` (device flow) / `logout` / `whoami`, `sessions` (Claude Code + Codex), `sync <id>` / `sync --dir`, `unsync`, `rules`, `watch` (live incremental upload + live inbox events). Nothing uploads without a rule; secrets redacted; meta/injected text dropped. `cli/test/e2e.mjs` passes (18 checks).
- [x] AnyDock MCP for Claude Code and Codex: share, handover, inbox, list works, read a work's trajectory, ask why. `cli/test/mcp-e2e.mjs` passes (23 checks).
- [x] **Live at https://anydock.ai** (deployed Oct 17): home page with install command, login + device pages, API, `curl -fsSL https://anydock.ai/install.sh | sh`, self-updating CLI. Remote D1 migrated, `BETTER_AUTH_SECRET` set.
- [x] Production GitHub and Google OAuth sign-in verified end to end (Oct 17). Reused GitHub app 3892579, corrected callback to `/api/auth/callback/github`, and saved both credentials in Cloudflare; authenticated `/api/me` returned `qizi297@outlook.com`. Google project `western-pivot-512023-a8` under `qizi297@gmail.com`, client `AnyDock web`; both credentials in Cloudflare, callback and authenticated `/api/me` verified for `qizi297@gmail.com`. Google remains in Testing with that test user.
- [x] Local GitHub and Google OAuth configured in gitignored `server/.dev.vars` (0600), using localhost:8787. Both browser logins and authenticated `/api/me` verified Oct 17. GitHub app supports both production and localhost callbacks; Google Data Access explicitly saved with only openid/email/profile.
- [x] Primitive configured Oct 17: AnyDock organization via GitHub `naifuliang` (`qizi297@outlook.com`), $100 hackathon credits redeemed with no expiry; `PRIMITIVE_API_KEY` and `EMAIL_FROM` saved through Wrangler. Production sign-in email from `login@lush-fig.primitive.email` arrived in the real Outlook inbox. Nolan completed email-code login; authenticated session verified. System mail later migrated to Cloudflare own-domain sender.
- [x] Oct 17 (deployed): native Mac approval panel (Touch ID / password), approvals merged into Inbox, Gmail/Outlook "email as you", Inkbox texts + phone settings; remote migration 0006 applied. Native panel not yet tried by a human.
- [x] Oct 18: agent tokens can't approve (server-enforced), Mac approvals are Secure Enclave signatures, token stored in Keychain / Secret Service / encrypted file; installer auto-installs Node. Tests: `server/test/agent-trust-e2e.mjs` (22 checks) + all suites green. Real Touch ID signing not yet tried by a human.
- [x] Oct 18: artifacts — docs, slides, sheets, LaTeX, web pages, apps, Office/PDF files; live co-editing, share, hand over, permissions, history; MCP + CLI + skill; Mac viewer window; `u.anydock.ai` for apps. Deployed. The Mac window and real Touch ID signing are not yet tried by a human.
- [x] Oct 18: app backends — per-app data store, `anydock.call` through grants, person → agent → app permissions that only narrow (grants need the person; re-checked on every call; agent sign-out revokes), sandbox runtime interface + Blaxel adapter (mock-tested; live once Codex adds the key). Deployed (migration 0011).
- [x] Oct 18: per agent session permissions — inherit, narrow, "This session" approvals (Touch ID / dashboard / Slack), sessions panel, `anydock_permissions`. Deployed (migration 0012).
- [ ] Not yet installed into Nolan's real Claude Code / Codex config (`anydock mcp install`).
- [ ] Next candidates: localhost UI, distill (summary + method), delegate actions (Slack / email / call) + permission panel.

## Open questions

- Passkey sign-in: deferred until the core flow works (Better Auth passkey plugin).
- Manufact track ("best MCP server", mcp-use): the local MCP is hand-rolled to keep the CLI dependency-free. To compete there, add a remote mcp-use server on the Worker exposing the same read-side tools.
- Armature analytics SDK requires MCP SDK 1.x; mcp-use v2 uses SDK v2 — check compatibility before targeting both tracks.

### Oct 17 sponsor setup update

- Slack app setup complete; installed into New Workspace with Nolan’s explicit authorization; own DM delivery verified.
- Gmail API, gmail.send declaration, production/local Gmail callbacks saved. Outlook app setup blocked by AADSTS16000 for personal Microsoft account.
- Inkbox: Google OAuth qizi297@gmail.com, free anydock identity and identity-scoped production key; INKBOX_API_KEY and INKBOX_IDENTITY_ID saved. Extra auto-minted Quickstart key revoked. Recipient opt-in and provider-level bidirectional iMessage verified via Messages; AnyDock approved send and actual Messages receipt verified. REST: POST https://inkbox.ai/api/v1/imessage/messages?agent_identity_id=<uuid>, X-API-Key header; requires recipient-first contact on shared service.
- Armature US AnyDock MCP workspace created; ARMATURE_INGEST_KEY stored. Ingest POST https://app.armature.tech/api/mcp-analytics/ingest, Authorization Bearer; wire event shape and SDK compatibility notes in tasks/armature-setup.md. SDK instrumentation and live events not done.
- Manufact Google OAuth account created; CLI login deferred. User authorized a Manufact connector with AnyDock organization permissions after setup. Implementation must enforce organization membership and per-resource access server-side, never return provider tokens, and audit/approve changes.

### Organization-controlled Manufact connector (Oct 17)

- Deployed Oct 17: migrations 0007/0008, Organizations dashboard, owner-managed membership (owner/admin/member), encrypted per-organization connection, explicit server allowlist and per-member read/redeploy grants. Members default deny; administrators default read/ask. Only owners change membership, connections or grants.
- Ask requires a different owner/admin, expires after 15 minutes, and is cancelled by membership/connection/grant changes. Atomic execution claim rechecks version, permissions and approver role. Request UUID prevents duplicate upstream requests. Running operations cannot be recalled.
- Dock MCP exposes organizations, allowed servers, projected server status, redeploy requests and request history; no approval/credential-management tools. Agents use their human bearer identity; separate agent identities and SSO/project inheritance remain future work.
- Provider keys stay encrypted server-side; server responses omit provider config/environment. Connection, membership, grant and server actions audited. Deployment acceptance is submitted, not deployed; uncertain outcomes need provider verification before retry.
- Local validation: 53 security/flow checks, dashboard/landing script parsing, server TypeScript and CLI build. Production migrations/deployment and live Manufact organization connection verified. The 30-day key is encrypted. One harmless free Manufact fixture is allowlisted; real read, denied redeploy, cross-account approval, provider Running and post-removal denial all verified. Temporary member/grants removed. See tasks/manufact-setup.md for evidence.

### Oct 17 final email boundary and live checks

- System authentication/account email uses Cloudflare Email Service from login@anydock.ai. Existing Workers Paid plan confirmed in account UI; no plan purchase. Sending domain enabled, DNS checked, and real Outlook receipt verified. Worker version cb8559bd-9f58-45fd-9d33-2f11cfd11dce deployed with sender-restricted EMAIL binding.
- Primitive is reserved for organization-controlled communication resources. Its credentials are retained but no system or global agent-email fallback uses them. Organization-level Primitive allocation is not implemented yet. Gmail/Outlook delegated email requires the acting user’s connected mailbox and permission check.
- Live checks complete: Gmail approved send to own Outlook received; Inkbox repaired identity-only key and approved AnyDock iMessage received in Messages; Slack own DM received; original email-code login completed by Nolan and authenticated session checked.
- Remaining setup blockers: personal Outlook account has no Entra tenant; Cursor/Windsurf/VS Code are absent for editor QA. Armature live instrumentation is separate implementation work.

### Blaxel setup and sponsor credits (Oct 17–18)

- Workspace `anydock`, Google qizi297@gmail.com, free Tier 0; 15 credits awarded (10 signup + 5 first sandbox), wallet says “In 11 Months” expiry. No card/top-up. The 180-credit bonus requires a first paid top-up and was skipped. No Blaxel redemption code found in YC chat.
- `BLAXEL_API_KEY` (workspace-only Member service account `anydock-runtime`, 30 days) and `BLAXEL_WORKSPACE` stored through Wrangler and names verified.
- One provider smoke sandbox ran Node v24.11.1; file/process/private port/public preview returned expected JSON; cleanup confirmed TERMINATED. Full app-artifact integration is not claimed by this provider smoke check.
- Setup table reconciled in tasks/RUNBOOK.md. CLI installed and authenticated; editor apps absent. Discord private server connection and command test now verified; Outlook tenant blocker remains.

- Oct 18 00:35 PDT: Discord private server 1561273593331982466, #general 1561273594372423784, linked to owner-only Connector verification project 5cc6e01a-e9dd-421f-9451-fd0444bc3c42. Actual connected embed and signed `/anydock recent` empty-project reply verified after user-approved install. No invitations or trajectory uploads.
