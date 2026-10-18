# Task: let anyone sign in to anydock.ai (Google access + email codes)

For: Codex (or any agent with browser access to Nolan's signed-in Google and Primitive accounts).
Read `AGENTS.md` first. When done, update `SETUP.md` (step 3) and the Status section of `AGENTS.md`, commit **only the
files you changed**, and push. Another agent works in this repo at the same time: don't commit or revert anyone else's files.

## Why

GitHub sign-in works for everyone. Email delivery remains needed for the demo. Additional Google test users are deferred by Nolan (Oct 17); the recorded demo uses accounts we control. No judge accounts or judge onboarding.

1. **Google sign-in only works for listed test users.** The OAuth app (project `western-pivot-512023-a8`, client
   `AnyDock web`, under `qizi297@gmail.com`) is in *Testing*, with only `qizi297@gmail.com` allowed.
2. **Email sign-in codes are delivered through Cloudflare** from login@anydock.ai; see Part 2.

## Rules

- Paste API keys and secrets **only** into `npx wrangler secret put …` (run in `server/`). Never write them to a file,
  a commit, chat, or logs.
- Don't change other Google Cloud or account settings, and don't add scopes beyond `openid`, `email`, `profile`.
- No redeploy is needed: `wrangler secret put` updates the live Worker.

## Part 1 — Google: additional test users (deferred)

Nolan explicitly deferred adding test users on Oct 17. Keep the existing test user and scopes unchanged.
Do not request judge email addresses or create judge accounts. Revisit only if Nolan later requests teammate access.

**Don't publish the app to Production yet.** Publishing needs a privacy policy and terms URL on anydock.ai, which don't
exist. If Nolan wants it public, stop and tell him; the other agent will add `/privacy` and `/terms` pages first.

## Part 2 — Cloudflare system email (supersedes Primitive instructions)

Nolan clarified that Primitive is an organization resource. Platform email now uses Cloudflare Email Service, an EMAIL binding restricted to login@anydock.ai, and SYSTEM_EMAIL_FROM. Production fails closed when the binding is missing; no Primitive fallback. The existing Workers Paid plan is confirmed, sending domain/DNS configured, and production OTP delivery verified in Outlook at 2026-10-18T05:16:31Z. Nolan completed the earlier OTP login and authenticated /api/me was verified.

Primitive account, $100 redeemed credits and credentials remain reserved for a future organization-scoped connector.

## Done when

- Additional Google test users: deferred by Nolan, not required.
- [x] Email-code login and real email delivery verified.
- [x] SETUP.md and AGENTS.md record Cloudflare system-email boundary.
