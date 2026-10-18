# Task: let anyone sign in to anydock.ai (Google access + email codes)

For: Codex (or any agent with browser access to Nolan's signed-in Google and Primitive accounts).
Read `AGENTS.md` first. When done, update `SETUP.md` (step 3) and the Status section of `AGENTS.md`, commit **only the
files you changed**, and push. Another agent works in this repo at the same time: don't commit or revert anyone else's files.

## Why

GitHub sign-in works for everyone. Email delivery remains needed for the demo. Additional Google test users are deferred by Nolan (Oct 17); the recorded demo uses accounts we control. No judge accounts or judge onboarding.

1. **Google sign-in only works for listed test users.** The OAuth app (project `western-pivot-512023-a8`, client
   `AnyDock web`, under `qizi297@gmail.com`) is in *Testing*, with only `qizi297@gmail.com` allowed.
2. **Email sign-in codes are never delivered.** No email sender is configured, so codes only appear in the Worker log.

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

## Part 2 — Email codes via Primitive (hackathon sponsor)

The server already sends through Primitive when two secrets exist (`server/src/email.ts`:
`POST https://api.primitive.dev/v1/send-mail` with `from`, `to`, `subject`, `body_text`).

1. Sign up / sign in at https://primitive.dev (use Nolan's account; ask him which email if unsure).
2. Create an **API key**.
3. Find the org's managed sending subdomain (looks like `brave-otter.primitive.email`). The sender address will be
   `login@<that-subdomain>`.
4. In `server/`:
   - `npx wrangler secret put PRIMITIVE_API_KEY` → paste the API key
   - `npx wrangler secret put EMAIL_FROM` → `login@<that-subdomain>`
5. Verify: on https://anydock.ai/login enter Nolan's email, click **Email me a code**, and confirm the code arrives and
   signs in.
6. If the send fails with `403 recipient_not_allowed` (new Primitive accounts restrict outside recipients), follow the
   fix in Primitive's error message / dashboard to allow sending to outside addresses, then retry step 5. To see the
   server-side error: `cd server && npx wrangler tail` while requesting a code.

## Done when

- [ ] Additional Google test-user verification — deferred by Nolan; not required for the recorded demo.
- [ ] An email code sent from https://anydock.ai/login arrives in a real inbox and signs in.
- [ ] `SETUP.md` step 3 ticked and `AGENTS.md` Status updated; your commit pushed.
