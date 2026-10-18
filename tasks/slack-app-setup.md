# Task: create the AnyDock Slack app (for "delegate": agents post as you, approvals in Slack)

For: Codex (or any agent with browser access to Nolan's signed-in Slack workspace).
Read `AGENTS.md` first. When done, tick the boxes, update the Status section of `AGENTS.md`, commit **only the files you
changed**, and push. Another agent is writing the Slack connector code at the same time — don't edit `server/src/**`.

## Why

AnyDock's delegate feature lets an agent act **as the person it works for**: post in Slack with that person's own user
token, and ask them for approval (Approve / Deny buttons in a Slack DM) when an action is set to "ask me". The agent never
sees the token: AnyDock stores it server-side and performs the call after checking the person's permission rules.

The server code will expect these routes (being built now; they don't need to exist for you to finish this task):
- OAuth redirect: `https://anydock.ai/api/connectors/slack/callback`
- Interactivity (button clicks): `https://anydock.ai/api/connectors/slack/interactions`

## Rules

- Paste client secret and signing secret **only** into `npx wrangler secret put …` (run in `server/`). Never into a file,
  a commit, chat or logs. The client id is not secret but still goes in via `wrangler secret put`.
- Don't install the app into any workspace other than Nolan's test workspace, and don't add scopes beyond the list below.

## Steps

1. https://api.slack.com/apps → **Create New App** → **From scratch** → name `AnyDock`, workspace: Nolan's workspace.
2. **Basic Information**
   - App icon: upload `server/public/img/icon.png`; background color `#FFFFFF`.
   - Short description: `Share and hand over agent work across teammates and their agents.`
   - Copy **Client ID** → `npx wrangler secret put SLACK_CLIENT_ID`
   - Copy **Client Secret** → `npx wrangler secret put SLACK_CLIENT_SECRET`
   - Copy **Signing Secret** → `npx wrangler secret put SLACK_SIGNING_SECRET`
3. **OAuth & Permissions**
   - Redirect URLs: add `https://anydock.ai/api/connectors/slack/callback` (and `http://localhost:8787/api/connectors/slack/callback` for dev). Save.
   - **User Token Scopes** (the agent acts as the person): `chat:write`, `channels:read`, `groups:read`, `im:write`, `users:read`, `users:read.email`
   - **Bot Token Scopes** (only for approval DMs from "AnyDock"): `chat:write`, `im:write`, `users:read`, `users:read.email`
4. **Interactivity & Shortcuts** → On → Request URL `https://anydock.ai/api/connectors/slack/interactions` → Save.
   (Slack may warn the URL doesn't respond yet; that's fine until the code is deployed.)
5. **App Home** → Messages Tab: on; "Allow users to send Slash commands and messages from the messages tab": off.
6. Don't click "Install to Workspace" yourself — Nolan connects Slack from the AnyDock dashboard (that install grants
   both the bot and his user token through the redirect above).

## Done when

- [x] Secrets `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` set (`npx wrangler secret list` shows the names).
- [x] Redirect URLs, user + bot scopes and the interactivity URL saved exactly as above (Oct 17, app `A0CA7H6T2PN`, verified saved manifest).
- [x] Configuration progress documented and commit pushed.

## Oct 17 progress

Old app `A0C508BD6ET` permanently deleted with explicit confirmation. New app `A0CA7H6T2PN` created, not installed. Manifest settings saved: exact scope lists, two callbacks, HTTP interactivity, Messages tab on/read-only, socket mode off, description and white background. Icon remains pending. `SLACK_CLIENT_ID` saved via Wrangler. Client secret appeared in diagnostic selected-page text; Nolan must regenerate it before production use. Signing secret not yet saved.

Nolan confirmed client-secret regeneration. New client secret and signing secret stored via Wrangler, and all 3 names verified with `wrangler secret list`. Original exposed client secret is no longer the configured credential. Icon still pending.

Icon uploaded from `server/public/img/icon.png`; Slack returned Success (Oct 17). Account setup complete; workspace install intentionally left for Nolan through AnyDock.
