# Task: turn on GitHub and Google sign-in for anydock.ai

For: Codex (or any agent with browser access to Nolan's signed-in GitHub / Google accounts).
Read `AGENTS.md` first. When done, tick the boxes in `SETUP.md` steps 1–2, update the Status section of `AGENTS.md`, commit, and push.

## Why

`https://anydock.ai/login` only shows "Continue with GitHub / Google" when the Worker has that provider's
client id and secret (`server/src/index.ts` → `providers()`; `server/src/auth.ts` → `socialProviders`).
None are set yet, so only email codes exist — and email has no sender yet either.

## Rules

- Paste client secrets **only** into `npx wrangler secret put …` (run in `server/`). Never write them to a file, a commit, chat, or logs.
- Don't change any other GitHub / Google account settings.
- No redeploy is needed: `wrangler secret put` updates the live Worker.

## 1. GitHub (do this first; it's the quick one)

1. Open https://github.com/settings/applications/new (Nolan's account).
2. Fill in exactly:
   - Application name: `AnyDock`
   - Homepage URL: `https://anydock.ai`
   - Application description: `Share and hand over agent work across teammates and their agents.`
   - Authorization callback URL: `https://anydock.ai/api/auth/callback/github`
   - Enable Device Flow: leave unchecked
3. Click **Register application**.
4. Run `cd server && npx wrangler secret put GITHUB_CLIENT_ID` and paste the **Client ID**.
5. Click **Generate a new client secret**, then run `npx wrangler secret put GITHUB_CLIENT_SECRET` and paste it.
6. Verify: https://anydock.ai/login shows **Continue with GitHub**, and clicking it reaches GitHub's "Authorize AnyDock" page with callback `https://anydock.ai/api/auth/callback/github`.

## 2. Google

1. https://console.cloud.google.com → create (or pick) a project named `AnyDock`.
2. APIs & Services → **OAuth consent screen** (Google Auth Platform → Branding/Audience):
   - App name `AnyDock`, support email = Nolan's, audience **External**, add Nolan's email as a **test user**.
   - Scopes: `openid`, `email`, `profile` only.
3. APIs & Services → **Credentials** → Create credentials → **OAuth client ID** → **Web application**, name `AnyDock web`:
   - Authorized JavaScript origins: `https://anydock.ai` and `http://localhost:8787`
   - Authorized redirect URIs: `https://anydock.ai/api/auth/callback/google` and `http://localhost:8787/api/auth/callback/google`
4. `npx wrangler secret put GOOGLE_CLIENT_ID` (client ID), then `npx wrangler secret put GOOGLE_CLIENT_SECRET` (client secret).
5. Verify: https://anydock.ai/login shows **Continue with Google** and it reaches Google's account chooser.

## 3. Optional: local dev

For `wrangler dev` sign-in with GitHub, create a second GitHub OAuth app (`AnyDock (dev)`, homepage `http://localhost:8787`,
callback `http://localhost:8787/api/auth/callback/github`) and put its id/secret in `server/.dev.vars` (gitignored).
The Google client above already allows localhost; put its id/secret in `server/.dev.vars` too.
