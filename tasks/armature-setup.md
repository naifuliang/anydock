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

- [x] `ARMATURE_INGEST_KEY` set via Wrangler Oct 17.
- [x] Ingest endpoint, auth header and event shape recorded below.
- [ ] Your commit pushed.

## Oct 17 verified setup

Google OAuth `qizi297@gmail.com`; US workspace **AnyDock MCP**, free usage meter 0/1,000 monthly credits. Key generated with explicit confirmation and stored via Wrangler; no session data uploaded.

Official SDK `@armature-tech/mcp-analytics@0.6.47` (`dist/esm/emit.js`, `types.d.ts`) uses `POST https://app.armature.tech/api/mcp-analytics/ingest`, `Authorization: Bearer <ingest key>`, JSON `{schema_version:1, events:[...]}`. A tool-call event has `event_id`, `kind:"tool_call"`, `actor_id`, `session_id_hint`, `started_at`, `finished_at`, `duration_ms`, `ok`, `error`, `metadata` (tool context), `script_source`, truncation flags, `result_preview`, `calls`, `logs`, `search_calls`. Prefer SDK encoding rather than guessing tool metadata. SDK supports MCP v1 and v2; previous compatibility question is outdated. Docs: https://docs.armature.tech/sdks/typescript and https://docs.armature.tech/sdks/telemetry. Docs and installed package differ on legacy telemetry names; use current package types.
