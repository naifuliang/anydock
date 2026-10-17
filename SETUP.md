# SETUP.md — account steps a human (or Codex with browser access) must do

Agents must not create accounts or handle OAuth client secrets / API keys themselves. Do these by hand,
then paste secrets **directly** into Cloudflare (`npx wrangler secret put NAME`, run in `server/`) and into
`server/.dev.vars` for local dev. Never commit secrets. Tick each box when done.

Production URL: `https://anydock.ai` · Local dev URL: `http://localhost:8787`

## 1. GitHub sign-in

- [ ] Create an OAuth App at https://github.com/settings/applications/new
  - Application name: `AnyDock`
  - Homepage URL: `https://anydock.ai`
  - Authorization callback URL: `https://anydock.ai/api/auth/callback/github`
- [ ] Create a second OAuth App for local dev (GitHub allows one callback per app)
  - Name `AnyDock (dev)`, homepage `http://localhost:8787`, callback `http://localhost:8787/api/auth/callback/github`
- [ ] Production: `npx wrangler secret put GITHUB_CLIENT_ID` and `npx wrangler secret put GITHUB_CLIENT_SECRET`
- [ ] Dev: add `GITHUB_CLIENT_ID=…` and `GITHUB_CLIENT_SECRET=…` (from the dev app) to `server/.dev.vars`

## 2. Google sign-in

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

- [ ] Production: `openssl rand -hex 32 | npx wrangler secret put BETTER_AUTH_SECRET`
  (local dev already has one in `server/.dev.vars`)

## 5. First deploy (an agent can do this once 1–4 are done and you say go)

- `npx wrangler d1 migrations apply anydock-v2 --remote`
- `npx wrangler deploy`
- Attach the custom domain `anydock.ai` to the `anydock` Worker (Cloudflare dashboard → Workers → anydock → Domains, or a `routes` entry in `wrangler.jsonc`)
