# AnyDock demo — 2-minute video (due Oct 18, 10:00 AM)

Deliverables: a 2-minute video, the repo link (we open-source it at submission), and two sentences.

**Two sentences:** Agents made you 10x. AnyDock — GitHub for your agents' work — makes your team 10x.

## Rules for the video

- **Real wherever possible.** Every product shot is the real product on anydock.ai with real accounts. The only
  non-recorded footage is the landing page's own animations (they are part of the real site).
- **Nothing that doesn't exist.** Every feature on screen works today and a judge could try it.
- **No seams.** Same two people, same titles, same data in every shot (see Continuity). No test data on screen.
- **Clean frames.** Window-only captures composited on Nolan's wallpaper; Focus on; no notifications, no other apps,
  no personal tabs, no tokens or emails other than the demo accounts.
- **≤ 2:00**, 1080p (or 1440p), narration + burned-in captions.

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
5. Dry-run the Touch ID / password panel once (shot 9) — the first run after an update may compile it (~20 s).
6. Make the repo public at submission time.

## Continuity (the same in every shot)

- Nolan's session: a Claude Code session in `~/Documents/ychackathon/sponsor-research` titled **"YC hackathon sponsor research"**
  (Codex records it fresh before shooting: research the 8 sponsors, decide to build on Primitive + Inkbox, with real
  web sources). This is the session that gets shared, asked why about, and handed over.
- The doc: **"Sponsor recommendation"** (AnyDock artifact made in that session).
- Jason's Codex task: **"next month's YC hackathon sponsors"**.
- Partner email: `qizi297@outlook.com` (outside the team, so it asks), subject **"AnyDock — sponsor summary"**.
- Slack: `#general` in the demo workspace.

## Shot list (≈2:00)

Source: **ANIM** = the live landing page's own animation (`anydock.ai/?scene=N` holds one hero scene); **REAL-C** = real
product, operated and recorded by Codex; **REAL-N** = real, needs Nolan (Touch ID, the phone).

| # | Time | Source | On screen | Narration |
|---|---|---|---|---|
| 1 | 0:00–0:06 | title | White card, type-on: "Agents made you 10x." → "AnyDock — GitHub for your agents' work — makes your team 10x." | "Agents made you ten-x. Your team? It's still running on you." |
| 2 | 0:06–0:26 | ANIM | Landing "human as glue" cards, each lit in turn: copy-paste between tools → an hour to show a colleague → handover docs nobody reads → "where did this come from?" → tokens pasted into agents. Cut in hero scenes 5 "Skip the meeting" and 8 "Pass the keys". | "You copy-paste between Slack and your agent. You hold a meeting to show a colleague what your agent figured out. You go on leave, and the work stops. Nobody remembers why a decision was made. And to let an agent post in Slack, you paste a token into a prompt. You've become the glue." |
| 3 | 0:26–0:32 | REAL-C (4× speed) | Terminal: `curl -fsSL https://anydock.ai/install.sh \| sh` → browser "Approve" → "Done." | "AnyDock is one line." |
| 4 | 0:32–0:46 | REAL-C | Left: Claude Code, *"share this research with Jason"* → tool result. Right: Jason's dashboard — Inbox badge lights up live, the work opens with its trajectory. | "I share my agent's session in one sentence — the whole trajectory, not a summary." |
| 5 | 0:46–0:58 | REAL-C | Right: Codex (Jason), *"use Nolan's method to research next month's YC hackathon sponsors"* → it reads the trajectory and starts the same steps. | "Jason uses Codex. Different vendor, same work. His agent learns my method." |
| 6 | 0:58–1:08 | REAL-C | Codex: *"why did we pick the Primitive track?"* → answer with `[n]` citations → click one → the dashboard jumps to that exact step. | "And it can ask why. Every answer points to the step where we decided." |
| 7 | 1:08–1:24 | REAL-C | Left: Claude Code, *"write our sponsor recommendation as an AnyDock doc"* → the doc opens in the side panel as a skeleton → sections fill in live. Jason edits one section at the same time (his colour, "Jason is editing"). Quick 2-s montage: the deck presenting, the sheet with a total, a small app running. | "The work isn't a chat log. My agent drafts a live doc — skeleton first — while Jason edits next to it. Decks, sheets, even small apps with their own backend." |
| 8 | 1:24–1:34 | REAL-C + REAL-N | Claude Code: *"hand this over to Jason — I'm off tomorrow"* → iPhone (iPhone Mirroring): iMessage "Nolan handed you …" → Jason's Inbox "Handover". | "I'm off tomorrow. One sentence — and Jason's agent picks up exactly where mine left off." |
| 9 | 1:34–1:50 | REAL-N (Touch ID) + REAL-C | Claude Code: *"email the summary to my partner"* → the Mac panel slides in → **This session** → Touch ID → sent from Gmail (cut: the email in the inbox). Then *"post it in #general"* → runs without asking (rule: allow) → Slack message. Flash: Permissions → Agent sessions. | "Agents act through your Slack, your Gmail, your phone — inside your rules. They never see a token, and they can't approve themselves. Only your fingerprint can." |
| 10 | 1:50–2:00 | title | Tagline card + `anydock.ai` + "Built at YC · Make Something Agents Want". | "Agents made you ten-x. AnyDock makes your team ten-x." |

Narration is ~250 words at a calm pace. If over 2:00, trim shot 5 first, then the montage in 7.

Fallbacks: if Inkbox lags, cut to Jason's Inbox (live). If the panel misbehaves, approve in the dashboard popup or Slack DM
(also real) and narrate "…or from Slack".

## How it gets made

`tasks/video-production.md` (Codex): seed the real session and data, record each REAL-C shot as a window-only clip over
the wallpaper, record the ANIM shots from the live site, assemble with ffmpeg, narration + captions. Nolan does shots 8–9's
phone and Touch ID moments and the voice (or approves a TTS voice).

## Not in the video (known gaps)

- Outlook send-as-you (personal Microsoft account has no tenant) — Gmail only.
- Armature instrumentation; Cursor / Windsurf / VS Code (untested here).
- Manager approval (subordinate → superior) exists only in the Manufact organization connector.
