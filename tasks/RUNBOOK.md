# Codex runbook — set up every account AnyDock's integrations need

Start here. Run the tasks below **in order**, one at a time, in `~/Documents/ychackathon/relay`. Each task file has its
own steps and "Done when" boxes. This page holds the rules that apply to all of them and the progress table you keep current.

Prompt to start: *"Read AGENTS.md and tasks/RUNBOOK.md in ~/Documents/ychackathon/relay, then work through the runbook."*

## Rules for every task

1. **Read `AGENTS.md` first.** Another agent (Claude) is writing code in this repo at the same time.
   Never edit `server/src/**`, `cli/src/**`, tests, or anyone else's files. Commit only the task files, `AGENTS.md`
   and `SETUP.md` lines you change, then `git pull --rebase && git push`.
2. **Secrets go only into `npx wrangler secret put NAME`** (run in `server/`). Never into files, commits, chat, logs,
   screenshots you save, or shell profiles. To check what's set: `npx wrangler secret list` (names only).
3. **Use Nolan's existing signed-in accounts** in his browser. Don't create a new account with a different email unless
   the task says so.
4. **Free tiers only.** No purchases, trials that need a card, phone numbers that cost money, or paid plans.
5. **Stop and ask Nolan** (write the question in the "Waiting on Nolan" column, then move on to the next task) when a step:
   - needs a 2FA code, a phone/SMS verification, a security key or a password you don't have;
   - asks for payment details or to start a paid trial;
   - asks you to accept terms that grant broad access (whole GitHub org, all repos, admin consent for a company tenant);
   - looks different enough from the task that you're unsure.
6. Don't add apps/bots to any Slack workspace or Discord server — Nolan connects them from the AnyDock dashboard.
7. Each secret takes effect on the live site immediately; **no redeploy needed**.

## Order

| # | Task | Unlocks | Status | Waiting on Nolan |
|---|---|---|---|---|
| 1 | `tasks/slack-app-setup.md` | Slack posting and approval DMs | ✅ live verified | None; authorized workspace connection and self-DM received |
| 2 | `tasks/discord-setup.md` | Project channels and slash commands | ⏸ configuration done | Logged-in Discord account has no manageable server for installation/test |
| 3 | `tasks/google-access-and-email.md` | Cloudflare own-domain email login; Primitive resource account | ✅ | Google extra test users deferred; Primitive organization connector is separate implementation |
| 4 | `tasks/email-accounts-setup.md` | Gmail / Outlook delegated mail | ⏸ Outlook blocked | Gmail delivered; personal Microsoft account lacks Entra tenant (AADSTS16000) |
| 5 | `tasks/inkbox-setup.md` | iMessage | ✅ live verified | Approved AnyDock message received; SMS/voice require separate availability |
| 6 | `tasks/armature-setup.md` | MCP analytics account | ✅ account setup | Instrumentation/live events are separate implementation |
| 7 | `tasks/manufact-setup.md` | Hosted MCP and organization connector | ✅ live verified | Free fixture Running; read/deny/ask/approve/revoke verified |
| 8 | `tasks/mcp-clients-qa.md` | Cursor / Windsurf / VS Code QA | ⚠️ prerequisite missing | CLI now installed and authenticated; target editors still absent |
| 9 | `tasks/blaxel-setup.md` | Artifact backend sandboxes | ✅ live provider test | 15 free credits awarded; scoped secrets saved; sandbox smoke passed and deleted |

Mark Status `✅` (done), `⏸` (waiting on Nolan) or `⚠️` (blocked — say why). Commit this file after each task.

## When everything is done

Post a short summary at the bottom of this file:
- which secrets now exist (names only),
- what's waiting on Nolan,
- anything that behaved differently from the task (so the code can be adjusted).

## Sponsor offers verified in YC chat (Oct 17)

Source: authenticated Safari chat, https://messages.ycombinator.com/messages/267340. Offers are recorded below; Primitive redemption is verified in the summary.

- **Primitive** — Ethan Byrd, 2:07 PM: **$100 credits**, code `AGENTS-WANT-IT-ALL`; https://www.primitive.dev/redeem#AGENTS-WANT-IT-ALL. Sponsor offered more if needed.
- **Inkbox** — Ray Liao, 11:26 AM: **100 agent identities per team**; visit the Inkbox booth to have the quota updated. No online redemption code posted in the message.
- **Manufact** — Luigi Pederzani posted track resources at 11:06 AM; another participant at 1:26 PM described emailing **founders@manufact.com** for a hackathon top-up. This is a participant-reported channel, not a guaranteed amount. Do not send a request without Nolan's authorization. Discord help: https://discord.com/invite/XkNkSkMz3V.
- **InsForge / Instabox** — Tony Chang, 3:42 PM: https://instabox.sh/, redemption code `556677`; amount not specified.
- **Supabase** — Nemil Dalal, 5:09 PM: ask him near the main-room entrance for codes; no code or amount posted.
- **Stripe** — Peter Masone, 4:13 PM: https://shipbysundown.dev/ and an Atlas incorporation discount. No Stripe API credit amount was posted; incorporation is outside this runbook.

## Historical execution log (latest status is in the table above)

- Oct 17 audit: Cloudflare currently has `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; added `PRIMITIVE_API_KEY` and `EMAIL_FROM` (names only).
- Google test users deferred by Nolan; demo will be recorded by the team, without judge accounts or judge interaction.
- Slack: old app `A0C508BD6ET` exists in New Workspace, with old scopes and no redirects. Nolan requested a fresh app, then explicitly confirmed permanent deletion of the old one. Deleted `A0C508BD6ET` Oct 17; Slack displayed "Your application has been deleted" and an empty app list. New app `A0CA7H6T2PN` created Oct 17; saved exact requested scopes, both redirects, HTTP interactivity URL and read-only Messages tab through manifest. `SLACK_CLIENT_ID` stored. Nolan regenerated the client secret; new `SLACK_CLIENT_SECRET` and `SLACK_SIGNING_SECRET` saved via Wrangler and all 3 Slack secret names verified. Icon uploaded successfully. App remains uninstalled.
- Discord app `1561232574444081184` created; Nolan reset token. Public Bot on, all privileged intents off; no server installation.
- Primitive GitHub read-only profile/email authorization and terms accepted with Nolan's explicit approval; AnyDock organization created under the existing account. The $100 hackathon credit was redeemed; dashboard confirms no expiry. `PRIMITIVE_API_KEY` and `EMAIL_FROM` saved via Wrangler; production code email delivered to the real Outlook inbox at 8:53 PM PDT. Final code-login session remains unverified because the connector withholds OTP.
- Inkbox: Google OAuth `qizi297@gmail.com`, Waffle's Org. Created free `anydock` identity (`anydock@inkboxmail.com`), Basic iMessage/shared line; no paid number. Approved `AnyDock production` identity-scoped key created and saved as `INKBOX_API_KEY`; verified secret name. `INKBOX_IDENTITY_ID` resolved through the authenticated API and saved. Recipient opt-in complete; Messages sent Hello and received the exact Inkbox console reply. Provider bilateral iMessage verified; AnyDock delegate flow unverified. Extra Quickstart key revoked with explicit confirmation; only production key remains active.
- Outlook app registration: Entra portal returned AADSTS16000 for personal `qizi297@outlook.com` in Microsoft Services tenant. No registration or paid subscription created.
- MCP client QA: `/Users/nolanliang/.anydock/bin/anydock` is absent; Cursor, Windsurf and VS Code were not found in `/Applications`. No live client compatibility claim verified.


- Manufact: account created with Google OAuth `qizi297@gmail.com`; anydock.ai added during onboarding. Local CLI device login was not approved and was cancelled; it is not needed for the current Cloudflare demo. No repo access or deployment.
- Gmail: enabled API request and saved Data Access with existing openid/profile/email plus only `gmail.send`; Google confirmed data access changes saved. Both Gmail callbacks saved on the existing client; send test remains pending.

- Armature: Google OAuth `qizi297@gmail.com`, US workspace `AnyDock MCP`; free dashboard shows 1,000 monthly credits. Approved ingest key saved as `ARMATURE_INGEST_KEY`; no existing sessions uploaded.
- Next authorized implementation: Manufact connector managed through AnyDock organization roles and resource grants. User explicitly requested implementation after setup; this supersedes the setup-only code-edit restriction for that implementation stage. Account-dependent verification remains open where documented.

- Manufact organization connector built locally with roles, resource grants, encrypted credentials, approvals and audit. 48 checks pass. Deployed and live-connected with 30-day key; zero resources granted.

- Discord: all 3 secret names verified, both callbacks saved, signed interaction endpoint accepted by Discord. Bot/server connection remains a dashboard action for Nolan.

- Oct 17: organization connector deployed with migrations 0007/0008; live Manufact connection encrypted and audited. No hosted servers, so live server operations remain unverified; 48 local checks cover permissions/approvals/retries. Outlook tenant, editor QA, Primitive final code-login and per-channel AnyDock flow tests remain open.

- Manufact live flow complete: free fixture running; member read succeeds, default redeploy denied, ask waits, other owner approves and provider reaches Running. Temporary member/grants removed; direct access denied after removal. 53 local checks pass. See tasks/manufact-setup.md.

- Gmail real send complete: Google test identity → approved AnyDock action → Gmail → actual Outlook receipt verified. Inkbox AnyDock send found missing /imessage prefix; fixed official path and added regression test. Correct endpoint then returned 401 for stored credential; identity-scoped repair key prepared, awaiting approval.

## Latest authoritative update — Oct 17, Cloudflare system mail

This update supersedes earlier pending statuses above. System sign-in/account emails now use Cloudflare Email Service and login@anydock.ai, on the already-paid Workers plan. Sending-domain DNS and real Outlook delivery verified; production EMAIL binding restricts the sender. A production authentication OTP was also received from login@anydock.ai at 2026-10-18T05:16:31Z. Primitive is an organization communication resource, never a system sender or unscoped agent fallback; its organization connector is still future work.

Completed live: original OTP login; Gmail send and inbox receipt; authorized Slack workspace connection and self-DM receipt; repaired identity-scoped Inkbox key and AnyDock approved iMessage receipt; Manufact free server, real cross-account approval/redeploy Running, and member/grant removal.

Still open: Discord bot install/channel test (no manageable servers on logged-in account); Outlook app registration (personal account lacks Entra tenant); editor QA (three target editors absent). Armature ingest credential is stored; instrumentation/live events are not implemented. No judge accounts are required.

## Sponsor credit recheck — Oct 17 late evening

Nolan clarified “code” means free sponsor quota/credits. Searched the authenticated YC chat for Blaxel: one match, Ankit Shah’s 4:20 PM question about Agent Drive/Applications waitlist access; no Blaxel redemption code or credit amount in that message. Public pricing advertises **up to $200** free credits, not a verified account award; Tier 0 has a 10-sandbox quota. Actual credited balance must be checked after onboarding. Terms/Privacy and Google login approved by Nolan. Source: https://messages.ycombinator.com/messages/267340 and https://blaxel.ai/pricing.

## Blaxel setup completed

Workspace anydock, Google qizi297@gmail.com, Tier 0. Received 10 signup + 5 first-sandbox credits; UI expiration “In 11 Months”. Member service-account key, 30 days, stored in Cloudflare with BLAXEL_WORKSPACE; names verified. Real Node 24 smoke server answered via authenticated endpoint and public preview; disposable sandbox deletion confirmed TERMINATED. No payment method/top-up, no invitation, no running smoke resource. See tasks/blaxel-setup.md for exact contract/timings. The 180-credit offer requires a paid top-up and was skipped.

Remaining blocked setup: Discord needs a manageable server (private demo-server request pending); Outlook needs an Entra tenant; editor UI QA needs installed editors. Primitive organization allocation and Armature instrumentation are implementation backlog, not completed account-setup tasks.
