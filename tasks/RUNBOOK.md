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
| 1 | `tasks/slack-app-setup.md` | Agents post in Slack as you; approval DMs with buttons | ☐ | |
| 2 | `tasks/discord-setup.md` | Project channels, handover cards, `/anydock why` | ☐ | |
| 3 | `tasks/google-access-and-email.md` — **Part 2 (Primitive) first**, then Part 1 (Google test users; ask Nolan for the email list) | Email sign-in codes; AnyDock-sent email | ☐ | |
| 4 | `tasks/email-accounts-setup.md` | Agents send from your own Gmail / Outlook | ☐ | |
| 5 | `tasks/inkbox-setup.md` | Texts / calls to the person a work was handed to | ☐ | |
| 6 | `tasks/armature-setup.md` | MCP analytics (sponsor track) | ☐ | |
| 7 | `tasks/manufact-setup.md` | Hosted MCP server (sponsor track) | ☐ | |
| 8 | `tasks/mcp-clients-qa.md` | Verifies Cursor / Windsurf / VS Code really work | ☐ | |

Mark Status `✅` (done), `⏸` (waiting on Nolan) or `⚠️` (blocked — say why). Commit this file after each task.

## When everything is done

Post a short summary at the bottom of this file:
- which secrets now exist (names only),
- what's waiting on Nolan,
- anything that behaved differently from the task (so the code can be adjusted).

## Summary

(none yet)
