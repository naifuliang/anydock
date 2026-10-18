# Task: set up Blaxel (sandboxes that run artifact apps' backends)

For: Codex (or any agent with browser access to Nolan's accounts). Read `AGENTS.md` and `tasks/RUNBOOK.md` first.
When done, tick the boxes, update the RUNBOOK row and the Status section of `AGENTS.md`, commit **only the files you
changed** (this file, `tasks/RUNBOOK.md`, `AGENTS.md`), `git pull --rebase`, and push. Another agent (Claude) writes the
runtime code at the same time — don't edit `server/src/**`, `cli/src/**` or tests.

## Why

AnyDock artifacts include small apps (a folder with `index.html`). Today they're static sites with a built-in data
store. Next they get a real backend: the app's server code runs in a **Blaxel sandbox** (hackathon sponsor), started
and stopped by AnyDock, behind a swappable "sandbox runtime" interface (Cloudflare Containers could replace it later).
Permissions narrow from the top down: person → agent → app, and the app never sees a third-party token.

## Rules

- **Free tier only.** No card, no paid plan, no trial that needs payment details. If any step needs one, stop and write
  what it costs in the RUNBOOK "Waiting on Nolan" column.
- Use Nolan's existing sign-in (Google `qizi297@gmail.com` or GitHub `naifuliang`), like the other sponsor accounts.
- Secrets go **only** into `cd server && npx wrangler secret put NAME`. Never into files, commits, chat, logs or
  screenshots you save. Check names with `npx wrangler secret list`.
- Create at most one test sandbox and **delete it** when the check is done. Don't leave anything running.
- If the YC hackathon chat or the Blaxel booth offered credits, note the offer (amount, expiry); redeem only if it needs
  no payment details.

## Steps

1. Sign up / sign in at https://app.blaxel.ai. Create (or reuse) a workspace named `anydock`.
2. Note what the free tier includes: sandbox hours or credits, max sandboxes, memory, idle/standby behavior, regions.
3. Create an **API key** for that workspace (a service account key is better than a personal one if offered).
4. Save secrets:
   - `npx wrangler secret put BLAXEL_API_KEY` → the key
   - `npx wrangler secret put BLAXEL_WORKSPACE` → the workspace id/name the API expects
5. From the official docs (https://docs.blaxel.ai — `llms.txt` if there is one), record **the exact REST contract** the
   Worker will call without an SDK. For each, write method, URL, headers and the minimal JSON body / response fields:
   - create a sandbox (image to use for Node 22+, memory, exposed port), and get its status
   - write a file into the sandbox (or upload several)
   - run a process (e.g. `node server.js`), with env vars, and read its logs / exit code
   - expose a port as a **public preview URL** (and whether previews can be private/token-protected)
   - stop / standby / delete a sandbox; how fast it resumes from standby
   - auth header names (e.g. `Authorization: Bearer …`, workspace header) and base URLs (control plane vs sandbox URL)
6. Smoke test with plain `curl` (key only in that one command's environment, not exported to the shell profile):
   create a sandbox → write `server.js` that answers `{"ok":true}` on port 3000 → start it → open the preview URL and
   see `{"ok":true}` → delete the sandbox. Record the timings (create, start, first response).
7. Write everything from steps 2, 5 and 6 into the "Findings" section below.

## Done when

- [ ] Blaxel account and workspace exist on the free tier (no payment details entered).
- [ ] `BLAXEL_API_KEY` and `BLAXEL_WORKSPACE` exist in `npx wrangler secret list` (names only).
- [ ] REST contract recorded below (create, files, process, preview URL, stop/delete, auth headers).
- [ ] Smoke test passed and the test sandbox is deleted.
- [ ] RUNBOOK row 9 updated; `AGENTS.md` Status updated; your commit pushed.

## Findings

_(fill in)_
