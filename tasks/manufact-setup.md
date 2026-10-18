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

## Verified documentation notes (Oct 17)

- Current official deployment guide: https://docs.mcp-use.com/typescript/server/deployment/mcp-use.md.
- Current CLI is `mcp-use` (guide installs the `mcp-use` package); authenticate with `mcp-use login`, deploy from the project root with `mcp-use deploy`. The old `@mcp-use/cli` instruction above should be rechecked before use.
- Build/start use the project's package.json scripts, overridable per server; monorepos can choose a root directory. Framework examples export the server from the entry module. See https://docs.manufact.com/dashboard/build-runtimes.
- Production/preview environment variables and secrets are configured in the dashboard; changes take effect on the next deployment, not immediately. See https://docs.manufact.com/dashboard/environment-variables.
- Docs show canonical `https://<slug>.deploy.mcp-use.com/mcp` and also examples under `<slug>.run.mcp-use.com/mcp`; use the actual URL printed by a successful deployment rather than guessing. No deployment performed.
- TOS/Privacy accepted with Nolan's confirmation; account created via Google OAuth `qizi297@gmail.com`, website anydock.ai. CLI device approval was not granted and the waiting process was cancelled; defer CLI login because the current Cloudflare demo does not need Manufact deployment.

## Organization connector implemented Oct 17

- Account onboarding completed; dashboard organization `Anydock`, ID `fc043283-16cd-4a38-af3d-6894b14662f5`, slug `org-85c9a288-4oqpu`. Zero hosted servers. CLI remains unapproved and is not required for this REST connector.
- New key form prepared as `AnyDock organization connector`, 30-day expiry; creation pending Nolan approval. No granular scopes offered by the form.
- `server/src/organizations.ts`, migration `0007_organizations.sql`, Organizations dashboard and five Dock MCP tools are implemented. Local validation: 47 authorization/flow checks, script parsing, TypeScript check and CLI build. Not deployed or live-connected.
- REST base: `https://cloud.manufact.com/api/v1`, Bearer auth. Connection validates `GET /organizations` and each allowed `GET /servers/:id`; only id/name/slug/status returned to clients. Redeploy uses `POST /deployments` with `{serverId,trigger:"redeploy",branch?}`; accepted deployment ID means submitted, not deployed. Sources: https://cloud.manufact.com/docs and https://docs.manufact.com/dashboard/api-keys.
- Owner controls membership, encrypted connection and server grants; admin may approve another member's redeployment; members default deny. Ask expires after 15 minutes; policy, connection and membership edits cancel pending requests. Execution atomically checks current access and claims request once. Reusing a request UUID prevents duplicated submissions. Already-running upstream actions cannot be recalled.
- MCP: `anydock_organizations`, `anydock_manufact_servers`, `anydock_manufact_server`, `anydock_manufact_redeploy`, `anydock_organization_requests`. No approval/key-management MCP tool. Agents use their human bearer identity; agent-specific tokens and SSO/project inheritance are not implemented.
- Production verification still needs approved deployment/migration, an approved key connection and a selected real Manufact server. Do not redeploy a user's server solely to test without their authorization.
