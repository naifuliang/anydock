# AnyDock demo — 2-minute video (due Oct 18, 10:00 AM)

Deliverables: a 2-minute video, the repo link (open-sourced at submission), and two sentences.

**Two sentences:** Agents made you 10x. AnyDock — GitHub for your agents' work — makes your team 10x.

**The line people should repeat:** *"Claude started it. Codex finished it. Nobody had a meeting."*

## Rules for the video

- **No mock data.** Every product shot is the real product on anydock.ai, with real accounts, a real agent session, real
  messages. The only non-recorded footage is the landing page's own pain-point cards and two title cards.
- **Nothing that doesn't exist.** Every feature on screen works today.
- **One story, not a feature list.** Every feature appears because the story needs it.
- **Clean frames.** Window-only captures composited on Nolan's wallpaper; Focus on; no notifications, other apps,
  personal tabs, tokens, or addresses other than the two demo accounts.
- **≤ 2:00**, 1080p, narration + burned-in captions. Split-screen labels: "Nolan · Claude Code" | "Jason · Codex".

## Cast (one Mac, two accounts)

| Who | Account | Agent | Where |
|---|---|---|---|
| Nolan | qizi297@gmail.com (Slack + Gmail connected) | Claude Code in Terminal (`~/.anydock`) | left half, Edge profile "Nolan" |
| Jason (a second account we control) | qizi297@outlook.com, display name "Jason" | Codex CLI in Terminal with `CODEX_HOME=~/.codex-jason`, whose AnyDock MCP uses `ANYDOCK_HOME=~/.anydock-jason` | right half, Edge profile "Jason" |

Jason's phone = Nolan's iPhone (shown with iPhone Mirroring, labelled "Jason's phone"); Jason's AnyDock profile has
that number with "Text me when work is handed to me" on. Jason's approvals use his own approval key (same Mac, same finger).

## Before recording (one time)

Codex does all of this itself — the checklist is `tasks/video-production.md` §1. Steps 1–2 are already done.

1. ~~Codex CLI installed; Edge profile "Jason" signed in to anydock.ai as qizi297@outlook.com.~~
2. ~~Jason's AnyDock: `ANYDOCK_HOME=~/.anydock-jason anydock login` (approved in the Jason profile).~~
3. Jason's Codex: `mkdir ~/.codex-jason && cp ~/.codex/auth.json ~/.codex-jason/`, and `~/.codex-jason/config.toml` with
   `[mcp_servers.anydock]` `command = "/Users/nolanliang/.anydock/bin/anydock"`, `args = ["mcp"]`,
   `env = { ANYDOCK_HOME = "/Users/nolanliang/.anydock-jason", CODEX_HOME = "/Users/nolanliang/.codex-jason" }` (so AnyDock finds Jason's Codex sessions); copy `~/.codex/skills/anydock` into `~/.codex-jason/skills/`.
   Start it with `CODEX_HOME=~/.codex-jason codex`. Nolan's normal Codex is untouched.
4. Jason's dashboard → Permissions → "You": name "Jason", Nolan's number, "Text me when work is handed to me" on (or click the name card at the top of the sidebar).
4b. **Team:** in Nolan's dashboard → Projects, create "YC hackathon" and add qizi297@outlook.com. Then agents can say "share it with Jason" / "hand this to Jason" by name (names resolve among teammates; email works too).
5. Nolan's rules: "Email people outside the team" = Ask me (already). Delete the "Container smoke test" artifact.
6. Dry-run the whole story once, including one Touch ID panel (the first run after an update compiles it, ~20 s).
7. Make the repo public at submission time.

## Continuity

- Nolan's session: Claude Code in `~/Documents/ychackathon/sponsor-research`, **"YC hackathon sponsor research"** —
  recorded for real before shooting (research the 8 sponsors, decide on Primitive + Inkbox, with sources).
- The doc: **"Sponsor recommendation"**, made in that session (so it travels with the work).
- The app: **"Launch desk"** (shared task list + "Post status to #launch").
- Partner email: to qizi297@outlook.com, subject **"AnyDock — sponsor summary"**. Slack: `#launch` in the demo workspace (only Nolan is in it — no DMs to Jason).

## The story (≈2:00)

Source: **CARD** = landing-page pain card or title card; **REAL** = real product, recorded by Codex; **NOLAN** = needs
Nolan's finger or phone. Top-left pain tag: each act starts with its pain as a small tag, struck through when it's solved.

| # | Time | Source | On screen | Narration |
|---|---|---|---|---|
| 1 | 0:00–0:03 | CARD | White, type-on: "Agents made you 10x." | "Agents made you ten-x." |
| 2 | 0:03–0:13 | CARD | Landing pain cards slam in, ~2 s each: copy-paste between tools → an hour to show a colleague → you log off, the work stops → "where did this come from?" → tokens pasted into agents. | "Then you copy-paste for them. Hold meetings to explain what they did. Take a day off — the work stops. Ask why — nobody knows. And paste your tokens into prompts." |
| 3 | 0:13–0:19 | CARD | The cards stack up: "You've become the glue." → "AnyDock — GitHub for your agents' work." | "You've become the glue. AnyDock is GitHub for your agents' work." |
| 4 | 0:19–0:23 | REAL (4×) | Terminal: `curl -fsSL https://anydock.ai/install.sh \| sh` → approve in browser → "Done." | "One line to install." |
| 5 | 0:23–0:46 | REAL | **Act 1 — Claude starts.** Tag: ~~copy-paste~~. Left: Claude Code, *"write our sponsor recommendation as an AnyDock doc and share it with Jason"* → the doc opens as a skeleton and fills in section by section. Right: Jason's Inbox lights up; he opens the doc and edits one section — his colour, "Jason is editing" — while Claude writes the rest. | "My Claude Code drafts a live doc — skeleton first — and shares it. Jason edits right next to it." |
| 6 | 0:46–1:00 | REAL + NOLAN | **Aligned, no meeting.** Tag: ~~meetings~~ / ~~tokens~~. Left: *"see what Jason changed in the doc, post in #launch what I still need from him, and email the summary to our partner"* → it reads the doc and its history (Jason's edit) → posts in #launch as Nolan (rule: allow, no prompt) → the email asks: the Mac panel slides in → **Touch ID** → sent from Gmail. | "My agent sees what Jason changed and tells the team what's next — no meeting. When it emails someone outside, it has to ask. It can't approve itself. Only my fingerprint can." |
| 7 | 1:00–1:32 | REAL + NOLAN | **Act 2 — the handoff (the aha).** Tag: ~~the work stops~~. Left: *"I'm off tomorrow. Hand this to Jason — next: finish the recommendation and send it."* → Jason's phone buzzes (iMessage). Right: Jason's **Codex**, *"pick up what Nolan handed me"* → it reads the whole trajectory, lists done / decided / next, and keeps writing **the same doc** (it updates live on the left too). Jason: *"why did we pick Primitive?"* → answer with `[n]` → click → the exact step. Big caption: **"Claude started it. Codex finished it. Nobody had a meeting."** | "I'm off tomorrow. One sentence — and Jason's Codex picks up exactly where my Claude left off. Every decision, every why, every file. Claude started it. Codex finished it. Nobody had a meeting." |
| 8 | 1:32–1:50 | REAL + NOLAN | **Act 3 — permissions that only narrow.** Tag: ~~wired by hand~~. Left: *"build the team a Launch desk app that can post status to #launch"* → the app opens → it asks for **only #launch, 7 days** → Mac panel → Touch ID → click "Post status" in the app → the message lands in #launch. Flash: the app's Permissions panel and the chain person → agent → session → app. | "It can even build the team an app — and hand it a slice of its permissions. Only #launch. Only a week. Granting is a permission too. It needs my fingerprint." |
| 9 | 1:50–2:00 | CARD | "The person leaves. The work doesn't." → "Agents made you 10x. AnyDock makes your team 10x." + anydock.ai | "The person leaves. The work doesn't. Agents made you ten-x. AnyDock makes your team ten-x." |

~240 words. If over 2:00: trim the install (4) and the permissions flash in 8 first; never trim 7.

Fallbacks: if Inkbox lags, cut to Jason's Inbox (also live). If a panel misbehaves, approve in the dashboard popup or
the Slack DM (also real) and adjust the line.

## How it gets made

`tasks/video-production.md`: Codex sets the stage, seeds the real session, and records raw clips (window-only, over the
wallpaper). Nolan does the two Touch ID moments, the phone, and the voice (or picks a TTS voice). Claude cuts the video
(ffmpeg: composite, split screen, tags, captions, titles) from the raw clips.

## Not in the video (known gaps)

- Outlook send-as-you (personal Microsoft account has no tenant) — Gmail only.
- Armature instrumentation; Cursor / Windsurf / VS Code (untested here).
- A separate distilled "method" document — the receiving agent learns the method from the full trajectory (and ask why).
