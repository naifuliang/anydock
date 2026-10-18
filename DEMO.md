# AnyDock demo — recording plan (due Oct 18, 10:00 AM)

Deliverables: a 2-minute video, the repo link, a two-sentence description. The team records it; no judge accounts.

**Two sentences:** AnyDock is Git for work, not just code. Your agents share their know-how, hand over unfinished work with its context, and act inside your permissions (Slack, Gmail, iMessage), so a team of people and agents keeps working without humans acting as the glue.

## Cast

| Who | Account | Agent | Screen |
|---|---|---|---|
| Nolan | qizi297@gmail.com — the Mac's AnyDock CLI is signed in as this; Slack + Gmail are connected here | Claude Code | left half |
| Jason (a teammate account we control) | qizi297@outlook.com (GitHub sign-in) in a separate browser profile | Codex, `ANYDOCK_HOME=~/.anydock-jason` | right half |

Nolan's phone gets the Inkbox iMessage (Jason's profile uses Nolan's number, which already opted in to the shared line).

## Before recording (one time)

1. Nolan's AnyDock: installed, signed in, MCP + skill in Claude Code and Codex, background sync running (`anydock service status`). Done Oct 18.
2. Jason in Codex: sign in a second identity, `ANYDOCK_HOME=~/.anydock-jason ~/.anydock/bin/anydock login` (approve as
   qizi297@outlook.com in the second browser profile), and add `env = { ANYDOCK_HOME = "/Users/nolanliang/.anydock-jason" }`
   under `[mcp_servers.anydock]` in `~/.codex/config.toml`. Restart Codex. (Without this, Codex acts as Nolan.)
3. Jason's dashboard (outlook account) → Permissions → "Your phone": Nolan's number, check "Text me when work is handed to me".
4. Nolan's rules: "Email people outside the team" = Ask me (already). Delete the "Container smoke test" artifact.
5. Dry-run the Touch ID / password panel once (scene 5) — first run after an update may compile it (~20 s).
6. Make the repo public (or share it with the judges) before submitting.
7. Recording: Cmd-Shift-5, 1080p+, Focus on (no notifications), large font in both terminals, iPhone Mirroring for the phone.

## Script (≈2:00)

| Time | Scene | What's on screen | Line |
|---|---|---|---|
| 0:00 | Hook | anydock.ai hero | "At my internship I spent all day copy-pasting between Slack and Claude. Am I the agent, or is it?" |
| 0:12 | **share** | Claude Code, in today's sponsor-research session: *"share this research with qizi297@gmail.com"* → Jason's Inbox lights up live | "This morning I researched the 8 sponsors with Claude. Instead of a meeting, I share it." |
| 0:30 | Different vendor | Jason in Codex: *"use Nolan's method to research next month's YC hackathon sponsors"* → reads the trajectory, replays the method | "Jason uses Codex. Doesn't matter: his agent learns my method, not a summary." |
| 0:50 | **Ask why** (main aha) | Codex: *"why did we pick the Primitive track?"* → answer with `[n]` citations → click a citation in the dashboard trajectory | "Decisions used to live in someone's head. Now they live in sessions that vanish. AnyDock keeps the why." |
| 1:00 | **Artifact** | Claude Code: *"write our sponsor recommendation as an AnyDock doc"* → the doc opens in the side panel as a skeleton → sections fill in one by one, live; Jason edits one section at the same time (his colour, "Jason is editing") | "The work isn't a chat log. It's a living doc both of us — and both our agents — write in." |
| 1:10 | **handover** | Claude Code: *"hand this over to Jason, I'm off tomorrow"* → iMessage arrives on the phone (Inkbox) → Jason's Inbox | "The person leaves. The work doesn't." |
| 1:25 | **delegate** | Claude Code: *"email partner@… a summary"* → Mac panel slides in → Touch ID → sent from Gmail; then *"post it in #general"* runs without asking (rule: allow) | "The agent acts as me, inside my rules. It never sees a token, and it can't approve itself." |
| 1:45 | Trust | Dashboard Permissions: rules, activity log, "Plugs into your SSO" | "Connect once for the team. Permissions follow your org." |
| 1:55 | Close | Landing tagline | "Agents made individuals 10x. AnyDock makes teams 10x." |

Fallbacks: if Inkbox lags, cut to Jason's Inbox (live). If the panel misbehaves, approve from the dashboard toast or Slack DM.

## Not in the demo (known gaps)

- Discord: configured, but no server installed — skip.
- Outlook send-as-you: personal Microsoft account has no Entra tenant — Gmail only.
- Armature: key stored, instrumentation not built. Cursor / Windsurf / VS Code: untested.
- Manager approval (subordinate → superior) exists only in the Manufact organization connector, not in delegate.
