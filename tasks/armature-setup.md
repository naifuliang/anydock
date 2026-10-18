# Task: Armature account for AnyDock MCP analytics (sponsor: "Best Agent Experience")

For: Codex (or any agent with browser access). Optional, after the Slack/Discord/email tasks.
Read `AGENTS.md` first. Commit **only the files you changed**, push. Don't edit `server/src/**` or `cli/src/**`.

## Why

Armature (armature.tech) shows how agents actually use an MCP server — which tools they call, where they fail — and runs
agent evals. AnyDock's MCP tools are the product's main surface, so this is real insight and a sponsor track.
The code will send tool-call events from the AnyDock server (not from users' machines), so the key stays server-side.

## Rules

- Paste the key **only** into `npx wrangler secret put ARMATURE_INGEST_KEY` (in `server/`). Never into a file, commit, chat or log.
- Free plan only; if a step needs payment, stop and ask Nolan.

## Steps

1. Sign up / sign in at https://armature.tech with Nolan's account (GitHub sign-in is fine).
2. Create a project named `AnyDock MCP`.
3. Create an **ingest API key** for it → `cd server && npx wrangler secret put ARMATURE_INGEST_KEY`.
4. From https://docs.armature.tech, find and record in `AGENTS.md` (Status section):
   - the HTTP ingest endpoint and auth header that the SDKs use (so a Cloudflare Worker can call it without the SDK),
   - the event shape for one tool call (tool name, arguments, result/error, duration, session id).
5. Optional: if Armature offers "agent reviews" / discoverability listing for an MCP server, note how to submit
   `https://anydock.ai/agents.md` — don't submit it yet.

## Done when

- [ ] `ARMATURE_INGEST_KEY` set.
- [ ] Ingest endpoint, auth header and event shape recorded in `AGENTS.md`.
- [ ] Your commit pushed.
