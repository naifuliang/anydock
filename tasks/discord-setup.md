# Task: create the AnyDock Discord app and bot

For: Codex (or any agent with browser access to Nolan's signed-in Discord account).
Read `AGENTS.md` first. When done, tick the boxes below, update the Status section of `AGENTS.md`, commit **only the files
you changed**, and push. Another agent is working in this repo at the same time: don't commit or revert anyone else's files.

## Why

AnyDock's Discord connector lets a team connect a Discord channel to an AnyDock project. The bot posts a card whenever
a work in that project is shared, handed over or linked, and answers `/anydock why <question>` and `/anydock recent`
from the project's works. The server code lives in `server/src/discord.ts`; it switches on once the three secrets below exist.
The server registers the slash commands itself on the first connect, so you don't need to register them by hand.

## Rules

- Paste the bot token, public key and application id **only** into `npx wrangler secret put …` (run in `server/`).
  Never write them to a file, a commit, chat, or logs.
- Don't enable any privileged gateway intents; the bot doesn't need them.
- Don't add the bot to any server yourself; Nolan does that from the AnyDock dashboard (step 6).

## Steps

1. Open https://discord.com/developers/applications → **New Application** → name `AnyDock` → create.
2. **General Information**
   - Description: `Share and hand over agent work across teammates and their agents.`
   - App icon: optional (skip if there's no image handy).
   - Copy **Application ID** → `npx wrangler secret put DISCORD_APPLICATION_ID`
   - Copy **Public Key** → `npx wrangler secret put DISCORD_PUBLIC_KEY`
3. **Bot**
   - Click **Reset Token**, copy it → `npx wrangler secret put DISCORD_BOT_TOKEN`
   - Leave **Public Bot** on (so other teams and judges can add it).
   - Leave all **Privileged Gateway Intents** off.
4. **OAuth2 → Redirects**: add both
   - `https://anydock.ai/api/discord/callback`
   - `http://localhost:8787/api/discord/callback`
5. **Interactions Endpoint URL** (General Information): set to `https://anydock.ai/api/discord/interactions` and Save.
   Discord sends a signed test request when you save; it only succeeds once the Discord code is deployed **and** the
   secrets from steps 2–3 are set. Check first: `curl -s https://anydock.ai/api/discord/status` must show
   `"configured":true`. If it shows `false` or 404, the code isn't deployed yet: finish steps 1–4, leave this one, and
   tell Nolan — come back to it after the next deploy.
6. Tell Nolan to verify: https://anydock.ai/app → Projects → open a project → **Connect Discord** → pick a server →
   pick a channel. A "Connected" message should appear in that channel, and `/anydock recent` should answer there.

## Done when

- [ ] Secrets `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN` set (`npx wrangler secret list` shows the names).
- [ ] Redirect URIs added.
- [ ] Interactions Endpoint URL saved successfully (or noted as waiting on deploy).
- [ ] `AGENTS.md` Status updated; your commit pushed.
