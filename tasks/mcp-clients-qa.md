# Task: verify AnyDock works in Cursor (and Windsurf / VS Code if installed)

For: Codex or any agent on Nolan's Mac. Read `AGENTS.md` first. This is a test-and-report task: don't change
`server/` or `cli/` code. If you find a bug, write it in the "Findings" section at the bottom of this file (steps to
reproduce, what you saw, what you expected), commit only this file, and push.

## Why

The landing page lists Cursor, Windsurf and VS Code as **Live** because they speak MCP, but only Claude Code and Codex have
been tested end to end. Verify it — or tell us to change the label.

## Preconditions

- AnyDock is installed and signed in on this Mac: `~/.anydock/bin/anydock whoami` prints an email.
  If not, stop and ask Nolan to run `curl -fsSL https://anydock.ai/install.sh | sh` first (it opens a browser sign-in).

## Steps

1. **Cursor**: add AnyDock to `~/.cursor/mcp.json` (create it if missing; keep any existing servers):
   ```json
   { "mcpServers": { "anydock": { "command": "/Users/nolanliang/.anydock/bin/anydock", "args": ["mcp"] } } }
   ```
   Restart Cursor. In Settings → MCP, confirm `anydock` is green and lists 6 tools
   (`anydock_share`, `anydock_handover`, `anydock_inbox`, `anydock_list_works`, `anydock_read_work`, `anydock_ask_why`).
2. In a Cursor chat inside any project folder, ask: "what did teammates send me on AnyDock?" → it should call
   `anydock_inbox` and answer (an empty inbox is a valid answer).
3. Ask: "list my AnyDock works" → `anydock_list_works`.
4. Note: Cursor's own chat sessions are **not** captured as shareable sessions yet (only Claude Code and Codex transcripts
   are). `anydock_share` from Cursor is expected to fail with "Couldn't find an active … session" — record the exact message.
5. **Windsurf** (`~/.codeium/windsurf/mcp_config.json`) and **VS Code** (user `mcp.json`, server type stdio): repeat 1–3 if
   the app is installed; otherwise write "not installed".

## Report

Fill in, commit this file, push:

| Client | Tools listed | inbox works | list_works works | share from it | Notes |
|---|---|---|---|---|---|
| Cursor | Not tested | Not tested | Not tested | Not tested | Not found in /Applications or ~/Applications Oct 17 |
| Windsurf | Not tested | Not tested | Not tested | Not tested | Not found in /Applications or ~/Applications Oct 17 |
| VS Code | Not tested | Not tested | Not tested | Not tested | Not found in /Applications or ~/Applications Oct 17 |

## Findings

Oct 17: prerequisite AnyDock executable `~/.anydock/bin/anydock` is absent. No MCP config changed and no editor installed. Live compatibility is unverified; treat these clients as MCP-compatible in principle, not tested live. Nolan must install/sign in to AnyDock and provide an editor before end-to-end QA.
