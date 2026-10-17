# SETUP.md — account steps a human (or Codex with browser access) must do

Agents must not create accounts or handle OAuth client secrets / API keys themselves. Do these by hand,
then paste secrets **directly** into Cloudflare (`npx wrangler secret put NAME`, run in `server/`) and into
`server/.dev.vars` for local dev. Never commit secrets. Tick each box when done.

Production URL: `https://anydock.ai` · Local dev URL: `http://localhost:8787`

## 1. GitHub sign-in

- [x] Reused existing AnyDock OAuth App (`3892579`, owner `naifuliang`); updated production callback on Oct 17. https://github.com/settings/applications/3892579
  - Application name: `AnyDock`
  - Homepage URL: `https://anydock.ai`
  - Authorization callback URL: `https://anydock.ai/api/auth/callback/github`
- [ ] Create a second OAuth App for local dev (GitHub allows one callback per app)
  - Name `AnyDock (dev)`, homepage `http://localhost:8787`, callback `http://localhost:8787/api/auth/callback/github`
- [x] Production: `GITHUB_CLIENT_ID` saved in Cloudflare (Oct 17).
- [ ] Production: `GITHUB_CLIENT_SECRET` still required; existing GitHub secret is masked. User must generate/enter the credential directly.
- [ ] Dev: add `GITHUB_CLIENT_ID=…` and `GITHUB_CLIENT_SECRET=…` (from the dev app) to `server/.dev.vars`

## 2. Google sign-in

Oct 17: created project **AnyDock** (`western-pivot-512023-a8`) under `qizi297@gmail.com`. Branding wizard prepared with AnyDock, support/contact `qizi297@gmail.com`, External audience. Paused at Google API Services User Data Policy acceptance; branding is not yet saved and no OAuth client exists. No existing project named AnyDock appeared in the account project list. No projects/apps deleted.

- [ ] https://console.cloud.google.com → APIs & Services → OAuth consent screen: External, app name `AnyDock`, add your email as a test user
- [ ] Credentials → Create credentials → OAuth client ID → Web application
  - Authorized JavaScript origins: `https://anydock.ai`, `http://localhost:8787`
  - Authorized redirect URIs: `https://anydock.ai/api/auth/callback/google`, `http://localhost:8787/api/auth/callback/google`
- [ ] Production: `npx wrangler secret put GOOGLE_CLIENT_ID` and `npx wrangler secret put GOOGLE_CLIENT_SECRET`
- [ ] Dev: add both to `server/.dev.vars`

## 3. Email codes via Primitive (sponsor)

Without these, sign-in codes are only printed in the server log (fine for local dev).

- [ ] Sign up at https://primitive.dev and create an API key
- [ ] Note your managed subdomain (e.g. `brave-otter.primitive.email`); the sender will be `login@<subdomain>`
- [ ] Production: `npx wrangler secret put PRIMITIVE_API_KEY` and `npx wrangler secret put EMAIL_FROM` (value `login@<subdomain>`)
- [ ] Send yourself one test email first. New accounts can get `403 recipient_not_allowed` on the first send to an outside address; the error response explains how to unlock it.

## 4. Server secret

- [x] Production `BETTER_AUTH_SECRET` set (random, Oct 17). Local dev has its own in `server/.dev.vars`.

## 5. Deploy

- [x] Deployed to `https://anydock.ai` (Oct 17). Redeploy any time with `cd server && npm run deploy`.

## Until 1–3 are done

Sign-in codes are only written to the Worker log. To sign in anyway: run `cd server && npx wrangler tail` in one terminal, request a code on https://anydock.ai/login, and read it from the log line `[email:dev] … sign-in code is NNNNNN`.
