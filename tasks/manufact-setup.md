# Task: Manufact account, so AnyDock can ship a hosted MCP server (sponsor: "Best MCP Server for Agents")

For: Codex (or any agent with browser access). Optional, do last.
Read `AGENTS.md` first. Commit **only the files you changed**, push. Don't edit `server/src/**` or `cli/src/**`.

## Why

AnyDock's MCP server runs locally today (`anydock mcp`, stdio). A hosted, remote MCP server built with `mcp-use` and
deployed on Manufact would let any MCP client connect by URL — and competes in Manufact's track. The code for it comes
next; this task just prepares the account and records how deployment works.

## Rules

- Never paste tokens into files, commits, chat or logs. If the Manufact CLI stores its own login locally, that's fine.
- Free plan only; if anything needs payment, stop and ask Nolan.
- Connect only the `naifuliang/anydock` GitHub repo if asked for repo access — not "all repositories".

## Steps

1. Sign up / sign in at https://manufact.com with Nolan's GitHub account.
2. Install and log in to the CLI once: `npx -y @mcp-use/cli login` (browser sign-in).
3. Read the deploy docs (https://docs.mcp-use.com/v2/typescript/getting-started/welcome and Manufact's deploy page) and
   record in `AGENTS.md` (Status section): the deploy command, how a project picks its entry file and env vars/secrets,
   and the public URL format a deployed server gets.
4. Don't deploy anything yet.

## Done when

- [ ] Manufact account exists and the CLI is logged in on this Mac.
- [ ] Deploy command, env/secret handling and URL format recorded in `AGENTS.md`.
- [ ] Your commit pushed.
