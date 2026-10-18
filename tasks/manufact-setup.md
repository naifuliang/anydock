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
- New key form prepared as `AnyDock organization connector`, 30-day expiry; created after Nolan approval. No granular scopes offered by the form.
- `server/src/organizations.ts`, migration `0007_organizations.sql`, Organizations dashboard and five Dock MCP tools are implemented. Local validation: 48 authorization/flow checks, script parsing, TypeScript check and CLI build. Deployed and live-connected.
- REST base: `https://cloud.manufact.com/api/v1`, Bearer auth. Connection validates `GET /organizations` and each allowed `GET /servers/:id`; only id/name/slug/status returned to clients. Redeploy uses `POST /deployments` with `{serverId,trigger:"redeploy",branch?}`; accepted deployment ID means submitted, not deployed. Sources: https://cloud.manufact.com/docs and https://docs.manufact.com/dashboard/api-keys.
- Owner controls membership, encrypted connection and server grants; admin may approve another member's redeployment; members default deny. Ask expires after 15 minutes; policy, connection and membership edits cancel pending requests. Execution atomically checks current access and claims request once. Reusing a request UUID prevents duplicated submissions. Already-running upstream actions cannot be recalled.
- MCP: `anydock_organizations`, `anydock_manufact_servers`, `anydock_manufact_server`, `anydock_manufact_redeploy`, `anydock_organization_requests`. No approval/key-management MCP tool. Agents use their human bearer identity; agent-specific tokens and SSO/project inheritance are not implemented.
- Deployment/migration and the approved key connection are verified. Live server-operation verification still needs a selected real Manufact server. Do not redeploy a user's server solely to test without their authorization.

## Production verification Oct 17

Nolan approved creation and deployment. The 30-day key was saved through AnyDock, encrypted at rest; browser password-save prompts declined. AnyDock organization `9f454c53-716c-4b45-8c2d-84d70a941947` connects to Manufact `fc043283-16cd-4a38-af3d-6894b14662f5`; dashboard shows Connected and manufact.connected audit. No resources selected.

Worker version `4be0d4ea-b7c1-4d39-af4b-e5b1f74912aa` deployed. Migration 0008 adds retry keys to already-applied 0007. Unauthenticated organization API returns 401. Initial fetch failed because Cloudflare rejects redirect:error; manual mode now rejects redirects without forwarding credentials. Connection errors report only safe stage/status.

48 local checks pass. Provider has zero servers; live server reads/redeploy and multi-person approval remain unverified. No Manufact server deployment or GitHub access. CLI still deferred.

## Free server and real approval flow verified Oct 17

Nolan authorized a free test server, GitHub App access to only `naifuliang/anydock`, and two controlled AnyDock identities for testing. GitHub App fixed permissions: metadata read; administration/checks/code/deployments/issues/PR read-write. Nolan completed GitHub reauthentication.

- Fixture: `examples/manufact-permission-smoke`, mcp-use 2.10.1, Node 24 Dockerfile, one public read-only ping tool. No production credentials or user data. Local ping and live MCP tools/list + ping return 200. Public URL: https://warm-forge-yvofr.run.mcp-use.com/mcp.
- Manufact server `9b81377e-50a9-42da-ae76-7e0c3f8220fb`, dashboard name `anydock`, organization Anydock. Billing shows Free active; $9.58/$10 included credits remained at verification, no paid plan/purchase.
- Root directory correctly saved. Initial watch-path text was not committed as a selection, so one repository push caused an additional automatic deploy. Corrected through deployment settings: chip `examples/manufact-permission-smoke/**`; provider confirmed “Deployment settings saved”. Later unrelated commits should not auto-deploy this fixture.
- AnyDock owner discovered and selected only this server using the encrypted saved key. Added owner's own Google identity as member. Read grant allowed a real running-status read; redeploy without grant returned forbidden and audit `redeploy.blocked`.
- Changed member redeploy to ask. Request `6066ce36-3f51-496a-9edc-8d554fb1677f` stayed pending with no member approval button. Different owner identity approved; D1 confirms userId differs from decidedBy. Provider deployment `01b91e64-b0ca-4ce3-a9e2-46ec114d2ac9` (Deployment #3) reached Running.
- Removed temporary member afterward. D1 confirms zero test members and zero grants; Google dashboard no longer lists organization; direct authenticated resource GET returns not_found. Server fixture retained free for review; owner alone remains.
- Server discovery and allowlist editing now reuse the encrypted connection. Server-side projection excludes config/secrets, only owner may manage resources, and version-guarded writes avoid overwriting a concurrently replaced connection. 53 local security/flow checks pass.
