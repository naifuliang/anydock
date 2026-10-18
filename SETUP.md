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

## 3. Email codes via Primitive — configured, delivery verified

Oct 17: signed in via existing GitHub `naifuliang` (`qizi297@outlook.com`), created the **AnyDock** organization, and accepted terms with Nolan's explicit approval. Redeemed `AGENTS-WANT-IT-ALL`: dashboard confirmed **$100 credits, no expiry** (in addition to the Developer allowance).

- [x] Primitive account and API key `AnyDock production email` created with Nolan's approval.
- [x] Managed domain: `lush-fig.primitive.email`; sender `login@lush-fig.primitive.email`.
- [x] Production secrets `PRIMITIVE_API_KEY` and `EMAIL_FROM` saved through Wrangler. Key never written to a file or printed in logs.
- [x] Production sign-in-code request returned success; Outlook connector verified the real email arrived at `qizi297@outlook.com` from the configured sender (Oct 17, 8:53 PM PDT).
- [ ] Completing sign-in with the delivered code remains unverified. The mailbox connector withholds one-time authentication codes; Nolan can complete this check directly.

## 4. Server secret

- [x] Production `BETTER_AUTH_SECRET` set (random, Oct 17). Local dev has its own in `server/.dev.vars`.

## 5. Deploy

- [x] Deployed to `https://anydock.ai` (Oct 17). Redeploy any time with `cd server && npm run deploy`.

## Email login verification

GitHub and Google OAuth remain verified. Primitive email delivery is now verified; complete a fresh email-code login at https://anydock.ai/login to verify the final session. Never publish codes or credentials.
