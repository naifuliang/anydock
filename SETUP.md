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
- [x] Local callback added to existing AnyDock app: `http://localhost:8787/api/auth/callback/github`. GitHub now supports multiple redirect URIs (up to 10 in the current UI), so a second app was unnecessary. Production callback retained; wildcard matching off.
- [x] Production: `GITHUB_CLIENT_ID` saved in Cloudflare (Oct 17).
- [x] Production: user generated a new GitHub client secret; saved directly to Cloudflare as `GITHUB_CLIENT_SECRET` (Oct 17). Full GitHub sign-in verified: signed-in landing page and authenticated `/api/me` returned `qizi297@outlook.com`. Existing older secret retained.
- [x] Dev: GitHub credentials saved in gitignored `server/.dev.vars` (mode 0600). Local login and authenticated `/api/me` verified for `qizi297@outlook.com`.

## 2. Google sign-in

Oct 17: created project **AnyDock** (`western-pivot-512023-a8`) under `qizi297@gmail.com`. Branding saved with AnyDock, support/contact `qizi297@gmail.com`, External audience; User Data Policy accepted with explicit user confirmation. Test user `qizi297@gmail.com` saved. User created `AnyDock web`; both Google credentials saved directly to Cloudflare. Production login shows Google and reaches the account chooser with callback `/api/auth/callback/google` and scopes `email profile openid`. Full Google sign-in verified Oct 17: consent completed, AnyDock displayed Signed in, and authenticated `/api/me` returned `qizi297@gmail.com`. Google remains in Testing with that test user. No existing project named AnyDock appeared in the account project list. No projects/apps deleted.

- [x] OAuth consent configuration saved: External, app name `AnyDock`, test user `qizi297@gmail.com`
- [x] Created OAuth client ID → Web application (`AnyDock web`)
  - Authorized JavaScript origins: `https://anydock.ai`, `http://localhost:8787`
  - Authorized redirect URIs: `https://anydock.ai/api/auth/callback/google`, `http://localhost:8787/api/auth/callback/google`
- [x] Production: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` saved in Cloudflare
- [x] Dev: Google credentials saved in gitignored `server/.dev.vars` (mode 0600); `BETTER_AUTH_URL=http://localhost:8787`. Local login and authenticated `/api/me` verified for `qizi297@gmail.com`.
- [x] Google Data Access saved with exactly `openid`, `userinfo.email`, and `userinfo.profile`; no sensitive or restricted scopes.

## 3. System email via Cloudflare — deployed and received

- [x] Existing Workers Paid plan verified; no new purchase.
- [x] anydock.ai sending domain enabled; SPF, DKIM, bounce MX and DMARC checked.
- [x] Worker EMAIL binding restricted to login@anydock.ai, SYSTEM_EMAIL_FROM configured.
- [x] Real production authentication OTP delivered to Outlook at 2026-10-18T05:16:31Z.
- [x] Nolan completed the earlier email-code login and authenticated /api/me was verified.

Primitive's AnyDock organization and $100 hackathon credits remain available for organization communication resources. Its saved credentials are not used for system mail or a global delegated-mail fallback. Organization-scoped Primitive allocation remains implementation work.

## 4. Server secret

- [x] Production `BETTER_AUTH_SECRET` set (random, Oct 17). Local dev has its own in `server/.dev.vars`.

## 5. Deploy

- [x] Deployed to `https://anydock.ai` (Oct 17). Redeploy any time with `cd server && npm run deploy`.

## Email login verification

GitHub, Google and email-code login verified. System email now uses Cloudflare and our own domain; real production OTP receipt verified. Never publish codes or credentials.
