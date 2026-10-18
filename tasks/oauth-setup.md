# Task: turn on GitHub and Google sign-in for anydock.ai

For: Codex (or any agent with browser access to Nolan's signed-in GitHub / Google accounts).
Read `AGENTS.md` first. When done, tick the boxes in `SETUP.md` steps 1–2, update the Status section of `AGENTS.md`, commit, and push.

## Why

`https://anydock.ai/login` only shows "Continue with GitHub / Google" when the Worker has that provider's
client id and secret (`server/src/index.ts` → `providers()`; `server/src/auth.ts` → `socialProviders`).
At task creation none were set. Both providers are now configured and verified; email sender setup remains a separate open task.

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

- [x] Existing GitHub app reused with an additional `http://localhost:8787/api/auth/callback/github` redirect URI. Current GitHub UI supports multiple redirects; no separate dev app was needed.
- [x] Both providers configured in gitignored `server/.dev.vars` with mode 0600 and local `BETTER_AUTH_URL`.
- [x] Both local browser sign-ins and authenticated `/api/me` responses verified.
- [x] Google Data Access explicitly saved with only openid, email, and profile.

## Completion — Oct 17, 2026

Production GitHub and Google credentials saved in Cloudflare. Both browser sign-in flows completed successfully and authenticated `/api/me` confirmed the expected identities. GitHub reused app 3892579; Google uses project `western-pivot-512023-a8` and `AnyDock web`. Google remains in Testing with `qizi297@gmail.com` as a test user. Local setup and both local sign-in flows also verified. OAuth checklist is complete. Primitive email setup remains an explicit open to-do in SETUP.md.
