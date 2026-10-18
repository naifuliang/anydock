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

- [x] Blaxel account and workspace exist on the free tier (no payment details entered).
- [x] `BLAXEL_API_KEY` and `BLAXEL_WORKSPACE` exist in `npx wrangler secret list` (names only).
- [x] REST contract recorded below (create, files, process, preview URL, stop/delete, auth headers).
- [x] Smoke test passed and the test sandbox is deleted.
- [x] RUNBOOK row 9 updated; `AGENTS.md` Status updated; your commit pushed.

## Findings

### Official REST contract checked Oct 17 (live validation pending)

Control plane `https://api.blaxel.ai/v0`: `Authorization: Bearer <key>`, `X-Blaxel-Workspace: <workspace name>`, JSON content type. Prefer a service-account key with **member** role, scoped to this workspace; personal keys cover all workspaces and the UI defaults service accounts to admin. See [access tokens](https://docs.blaxel.ai/Security/Access-tokens), [service accounts](https://docs.blaxel.ai/Security/Service-accounts).

- Create: `POST /sandboxes?createIfNotExist=true`, body `{"metadata":{"name":"anydock-setup-smoke"},"spec":{"region":"us-pdx-1","runtime":{"image":"blaxel/base-image:latest","memory":2048,"ports":[{"name":"http","target":3000,"protocol":"HTTP"}]}}}`. Inspect returned `metadata.url`, `metadata.name`, `status`; poll `GET /sandboxes/{name}`. Runtime image Node version must be verified by `node --version` before the smoke server. [Create schema](https://docs.blaxel.ai/api-reference/compute/create-sandbox)
- Data plane: use the returned sandbox URL, not a guessed hostname. Authentication supports `X-Blaxel-Authorization: Bearer <key>`; keep workspace header where required. `GET /filesystem/{encodedPath}` checks readiness. `PUT /filesystem/{encodedPath}` accepts JSON `{"content":"...","isDirectory":false}` or multipart `file`. Create `/app` as `{"isDirectory":true}` if needed. [File schema](https://docs.blaxel.ai/api-reference/filesystem/create-or-update-a-file-or-directory)
- Start: `POST /process`, JSON `{"name":"smoke","command":"node server.js","workingDir":"/app","env":{"PORT":"3000"},"waitForPorts":[3000]}`. Use `waitForCompletion:true` for one-shot commands. `GET /process/{identifier}` exposes status/exit code; `GET /process/{identifier}/logs` returns stdout/stderr. Do not assume HTTP success means process success. [Process schema](https://docs.blaxel.ai/api-reference/process/execute-a-command), [logs](https://docs.blaxel.ai/api-reference/process/get-process-logs)
- Public preview: control-plane `POST /sandboxes/{name}/previews`, JSON `{"metadata":{"name":"smoke"},"spec":{"port":3000,"public":true,"ttl":"10m"}}`; use returned `spec.url`. Private previews use `public:false` with separately created preview tokens (`X-Blaxel-Preview-Token`). AnyDock's current runtime uses authenticated `/port/3000` proxying instead of a public preview. [Preview schema](https://docs.blaxel.ai/api-reference/compute/create-sandbox-preview), [preview guide](https://docs.blaxel.ai/Sandboxes/Preview-url)
- Cleanup: `DELETE /sandboxes/{name}`, then verify absence/terminated status. Process stop is `DELETE /process/{identifier}`; poll terminal state. Automatic standby follows inactivity, documented resume approximately 25 ms; standby stops compute charges but snapshot storage can still accrue. Archive preserves filesystem separately; deletion is the intended smoke-test cleanup. [Lifecycle overview](https://docs.blaxel.ai/Sandboxes/Overview), [pricing](https://blaxel.ai/pricing)

### Free credit discovery

Public pricing advertises up to $200 free credits, Tier 0 up to 10 sandboxes; actual amount, expiry, memory/region eligibility require account verification. No Blaxel coupon found in the authenticated YC chat: its sole Blaxel match is a participant asking about waitlist access at 4:20 PM. No purchase or payment details entered. Google signup and Terms/Privacy approved by Nolan; onboarding in progress. This onboarding snapshot is superseded by the live outcome below.


### Live outcome (Oct 17 setup, completed around midnight Oct 18 PDT)

- Google identity qizi297@gmail.com; workspace display/name `anydock`; no card, top-up or paid plan.
- Created service account `anydock-runtime`, **Member**, with key “AnyDock sandbox runtime”, 30-day expiry (Nov 16 in creation form). Saved directly to Cloudflare `BLAXEL_API_KEY`; `BLAXEL_WORKSPACE=anydock`. Both names verified after saving. No plaintext credential file/log.
- **15 credits actually awarded**: 10 welcome credits + 5 first-sandbox promo. Both wallet entries display expiration “In 11 Months”. Remaining balance may fall slightly as usage settles. The advertised extra 180 credits requires a first top-up and was not claimed. Invite-teammate credits were not claimed; no invitations sent. Batch-job/volume promos were not pursued because this setup requires only one disposable sandbox.
- Account quota UI: Tier 0, 10 sandboxes total/active, max 4 GB RAM per instance, 5 Agents/MCPs/Jobs, job timeout 1 hour, 3-day logs/metrics retention, sandbox maximum 7 days. Public docs list Oregon us-pdx-1, North Virginia us-was-1, London eu-lon-1, Frankfurt eu-fra-1; smoke used Oregon.
- One disposable sandbox `anydock-setup-smoke`, 2048 MB, base image. Creation HTTP 200 in 0.51 s; node version v24.11.1, exit 0. Wrote /app/server.js through the documented file API. Process start HTTP 200 in 0.53 s, running; authenticated /port/3000 returned HTTP 200 and `{“ok”:true}` in 0.18 s. Public preview creation HTTP 200 and preview returned the same JSON.
- Cleanup DELETE returned HTTP 200; subsequent get confirmed **TERMINATED**. Preview is no longer a deliverable. No test workload left running.
- This proves the real provider REST smoke workflow. The existing AnyDock runtime adapter remains mock-tested; a complete artifact → Worker → Blaxel test is a separate application integration check. Source implementation was left to its concurrent owner as requested.
