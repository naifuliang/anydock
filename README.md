<p align="center"><img src="server/public/img/icon.png" width="88" alt="AnyDock"></p>

<h1 align="center">AnyDock</h1>

<p align="center"><b>Agents made you 10x. AnyDock — GitHub for your agents' work — makes your team 10x.</b></p>

<p align="center"><a href="https://anydock.ai">anydock.ai</a> · Built at YC's <i>Make Something Agents Want</i> hackathon, Oct 17–18, 2026</p>

---

> **Claude started it. Codex finished it. Nobody had a meeting.**

Your agent got faster. Your team didn't. Every agent session is an island: you copy-paste between tools for it, explain its
work in meetings, and the day you log off, the work stops — nobody can say *why* it did what it did.

AnyDock is the system of record for agent work. Every session keeps its **trajectory** (every step, source and decision),
its **artifacts** and its **permissions**, so a teammate — or a teammate's agent, in a different tool — can pick it up,
ask why, and keep going.

## What you can do

| | |
|---|---|
| **Share & hand over** | "Hand this to Jason." Context, decisions and access move together. Jason gets a text; his **Codex** picks up exactly where your **Claude Code** left off. |
| **Ask why** | Any answer about past work cites the exact trajectory steps behind it — the export, the filter, the reasoning — without waking anyone up. |
| **Live artifacts** | Agents write docs, decks, sheets, LaTeX, pages and **mini programs** that teammates open, co-edit and take over. Skeleton first, filled section by section, with live presence and per-section locks. Export to Word, PowerPoint, Excel, PDF. |
| **Act with your permissions** | Agents post in Slack, email from your Gmail and text people — within *your* rules: allow, ask me, or deny. |
| **Permissions only narrow** | Person → agent → session → app. An app gets exactly the slice it needs ("post to #launch, for 7 days") — and granting is itself a permission. |
| **Approval agents can't fake** | Approvals are signed by a Secure Enclave key behind **Touch ID / your Mac password**. An agent's token can request and deny, never approve. |

Works with **Claude Code** and **Codex** today (any MCP client by config): one neutral layer across vendors.

## Try it

```sh
curl -fsSL https://anydock.ai/install.sh | sh
```

One line installs the CLI (and Node if needed), signs you in through your browser once, connects Claude Code and Codex
(MCP server + skill), and starts background sync. Then just ask your agent:

- *"write our launch plan as an AnyDock doc and share it with Jason"*
- *"I'm off tomorrow — hand this to Jason"*
- *"pick up what Nolan handed me"* · *"why did we pick Primitive?"*
- *"build the team a launch board that can post our status to #launch"*

Nothing leaves your machine until you share it.

## How it works

```
 Claude Code ─┐                         ┌─ Teammate's Codex / Claude Code
 Codex ───────┼─ AnyDock MCP + CLI ──▶  │  anydock.ai (Cloudflare Workers)
 any MCP ─────┘   session capture,      │   D1  works, people, rules, approvals
                  token in Keychain,    │   R2  trajectories, artifact files
                  Touch ID approvals    │   Durable Objects  live rooms, inboxes, app containers
                                        └─ Slack · Gmail/Outlook · Inkbox (texts) · Discord
```

- **CLI + MCP** (`cli/`) — captures Claude Code / Codex sessions locally, syncs only what you share, exposes tools
  (share, handover, inbox, read work, ask why, artifacts, Slack, email, text, app grants). Self-updating; reloads in place.
- **Cloud** (`server/`) — Hono on Cloudflare Workers with Better Auth; D1, R2, Durable Objects; artifact rooms with
  live co-editing; mini-program backends in Cloudflare Containers (Blaxel as an alternative runtime).
- **Trust** — the CLI token lives in the macOS Keychain (Linux: Secret Service; else encrypted at rest), never in plain
  text. Approvals carry a device signature the server verifies; human-only routes refuse agent tokens.

## Repo layout

| Path | What's there |
|---|---|
| `cli/` | The `anydock` CLI and MCP server (TypeScript, bundled with esbuild); native Mac helpers (approval panel, Keychain, viewer) |
| `server/` | The Workers app: API, dashboard, landing page, artifact pages, delegate rules, connectors; D1 migrations; e2e tests |
| `examples/` | A Manufact permission smoke test |
| `AGENTS.md` | Product thesis, decisions, architecture and status — the single source of truth for humans and agents |
| `DEMO.md` | The 2-minute demo script |

## Run it locally

```sh
cd server && npm install && npx wrangler d1 migrations apply anydock-v2 --local
npx wrangler dev                      # http://localhost:8787 (secrets go in server/.dev.vars, see SETUP.md)
cd ../cli && npm install && npm run build
node ../server/public/cli/anydock.mjs login --server http://localhost:8787
```

End-to-end tests run against `wrangler dev`, e.g. `node server/test/artifacts-e2e.mjs dev.log`.

## Built with

Cloudflare Workers, D1, R2, Durable Objects and Containers · Hono · Better Auth · MCP · Swift (LocalAuthentication,
Secure Enclave) · **Inkbox** (texts to people on handover) · **Manufact** (hosted MCP connector) · **Blaxel** (sandboxed
app backends) · Slack, Gmail, Outlook and Discord APIs.

---

<p align="center"><i>The person leaves. The work doesn't.</i></p>
