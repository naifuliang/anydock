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
| 1 | `tasks/slack-app-setup.md` | Agents post in Slack as you; approval DMs with buttons | ⏸ app created/configured | Nolan to regenerate client secret after diagnostic exposure; remaining secrets/icon pending |
| 2 | `tasks/discord-setup.md` | Project channels, handover cards, `/anydock why` | ⏸ | Discord developer portal needs Nolan sign-in |
| 3 | `tasks/google-access-and-email.md` — **Part 2 (Primitive) first**, Part 1 deferred by Nolan (no judge accounts) | Email sign-in codes; AnyDock-sent email | ⏸ delivery verified | Nolan to complete final email-code login; Google test users deferred |
| 4 | `tasks/email-accounts-setup.md` | Agents send from your own Gmail / Outlook | ⏸ Outlook blocked | Personal Microsoft account lacks tenant access (AADSTS16000); Gmail pending |
| 5 | `tasks/inkbox-setup.md` | Texts / calls to the person a work was handed to | ⏸ identity created | Scoped key creation confirmation pending; recipient opt-in and test pending |
| 6 | `tasks/armature-setup.md` | MCP analytics (sponsor track) | ☐ | |
| 7 | `tasks/manufact-setup.md` | Hosted MCP server (sponsor track) | ⏸ docs recorded | Manufact login requires TOS confirmation; account/CLI login pending |
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
- Slack: old app `A0C508BD6ET` exists in New Workspace, with old scopes and no redirects. Nolan requested a fresh app, then explicitly confirmed permanent deletion of the old one. Deleted `A0C508BD6ET` Oct 17; Slack displayed "Your application has been deleted" and an empty app list. New app `A0CA7H6T2PN` created Oct 17; saved exact requested scopes, both redirects, HTTP interactivity URL and read-only Messages tab through manifest. `SLACK_CLIENT_ID` stored. Client secret requires Nolan regeneration after diagnostic output included selected page text; do not use it. Signing secret and icon pending. Removed the invalid `SLACK_CLIENT_SECRET` Cloudflare value; integration remains disabled until valid credentials are set.
- Discord developer portal is signed out; requires Nolan's sign-in.
- Primitive GitHub read-only profile/email authorization and terms accepted with Nolan's explicit approval; AnyDock organization created under the existing account. The $100 hackathon credit was redeemed; dashboard confirms no expiry. `PRIMITIVE_API_KEY` and `EMAIL_FROM` saved via Wrangler; production code email delivered to the real Outlook inbox at 8:53 PM PDT. Final code-login session remains unverified because the connector withholds OTP.
- Inkbox: Google OAuth `qizi297@gmail.com`, Waffle's Org. Created free `anydock` identity (`anydock@inkboxmail.com`), Basic iMessage/shared line; no paid number. Scoped key form prepared for this identity only, pending confirmation.
- Outlook app registration: Entra portal returned AADSTS16000 for personal `qizi297@outlook.com` in Microsoft Services tenant. No registration or paid subscription created.
- MCP client QA: `/Users/nolanliang/.anydock/bin/anydock` is absent; Cursor, Windsurf and VS Code were not found in `/Applications`. No live client compatibility claim verified.

