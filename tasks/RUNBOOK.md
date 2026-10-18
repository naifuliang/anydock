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
| 1 | `tasks/slack-app-setup.md` | Agents post in Slack as you; approval DMs with buttons | ✅ | Account configuration complete; Nolan connects from dashboard |
| 2 | `tasks/discord-setup.md` | Project channels, handover cards, `/anydock why` | ✅ | Configuration complete; Nolan connects a server from dashboard |
| 3 | `tasks/google-access-and-email.md` — **Part 2 (Primitive) first**, Part 1 deferred by Nolan (no judge accounts) | Email sign-in codes; AnyDock-sent email | ⏸ delivery verified | Nolan to complete final email-code login; Google test users deferred |
| 4 | `tasks/email-accounts-setup.md` | Agents send from your own Gmail / Outlook | ⏸ Outlook blocked | Personal Microsoft account lacks tenant access (AADSTS16000); Gmail API/scopes/callbacks configured; Outlook tenant access still blocked |
| 5 | `tasks/inkbox-setup.md` | Texts / calls to the person a work was handed to | ✅ provider setup | Identity/key configured; real bidirectional iMessage verified; AnyDock delegate test remains |
| 6 | `tasks/armature-setup.md` | MCP analytics (sponsor track) | ✅ account setup | Workspace/key prepared; SDK instrumentation is separate |
| 7 | `tasks/manufact-setup.md` | Hosted MCP server (sponsor track) | ✅ account/connector | Account and encrypted organization connection live; no hosted server; CLI deferred |
| 8 | `tasks/mcp-clients-qa.md` | Verifies Cursor / Windsurf / VS Code really work | ⚠️ prerequisite missing | AnyDock CLI and editors absent from standard app locations; see QA report |

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

## Summary

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
