# Task: record the raw footage for the 2-minute AnyDock video

For: Codex (computer use + shell). Read `AGENTS.md`, then **`DEMO.md` — it is the script** (story, shots, narration,
continuity, cast). You set the stage and record **raw clips**; Claude cuts the final video from them. Deadline: all raw
clips by **Oct 18, 7:30 AM PDT**.

## Rules

- **Real product, no mock data.** Real accounts, a real agent session, real messages (DEMO.md "Rules").
- **Window-only recordings**, never the full screen. Focus / Do Not Disturb on first. No other apps, personal tabs,
  bookmarks bar, notification banners, tokens, or addresses other than the two demo accounts. Check each clip.
- **Never approve as Nolan.** The two Touch ID moments (shots 6 and 8) and the phone (shot 7) are Nolan's — stop and ask.
  Don't click Approve in a dashboard to stand in for him.
- Only message the two demo accounts, `#launch` in the demo Slack workspace, and Nolan's own phone.
- Don't edit `server/src/**`, `cli/src/**` or tests. Working files go in `~/Documents/ychackathon/video/` (outside the
  repo). Commit only this file's checkboxes and notes.
- If the product misbehaves on camera, stop and report exactly what you saw (to Nolan and Claude). Don't work around it.

## Stop and ask Nolan when

- Installing the Codex CLI (`npm i -g @openai/codex`) and signing in to anydock.ai in the "Jason" Edge profile.
- Approving Jason's AnyDock CLI login in the browser.
- macOS asks for **Screen Recording** permission.
- Creating `#launch` in his Slack workspace (if it doesn't exist).
- Shots 6 and 8 (Touch ID) and 7 (the phone, via iPhone Mirroring).
- The voice: he records the narration, or picks one of your TTS samples.

## 1. Stage (one Mac, two people)

1. DEMO.md "Before recording" steps 1–6 (Codex CLI for Jason with `CODEX_HOME=~/.codex-jason`, Jason's AnyDock in
   `~/.anydock-jason`, Jason's phone + display name, cleanup, one full dry run).
2. Focus on, Dock hidden, quit unrelated apps. Save Nolan's wallpaper as `video/wallpaper.png` (screen resolution,
   nothing on it).
3. Edge profiles: **Nolan** (qizi297@gmail.com) and **Jason** (qizi297@outlook.com). Bookmarks bar off, zoom 110–125%.
4. Terminals: left = Nolan's Claude Code (`~/Documents/ychackathon/sponsor-research`), right = Jason's Codex
   (`CODEX_HOME=~/.codex-jason codex`). 16–18 pt font, light theme, short prompt.
5. Fixed layout: each recorded window exactly 960×1080 (split shots) or 1920×1080 (full shots), always the same
   positions, so clips line up.

## 2. Seed the real session

In Nolan's terminal start a **new** Claude Code session and run a real, short research task (it really browses):
"Research the 8 sponsors of YC's Make Something Agents Want hackathon (Primitive, Stripe, Manufact, Inkbox, InsForge,
Armature, Blaxel, Supabase); decide which tracks fit a tool that lets teams share and hand over agent work; recommend
one with reasons and sources." Make sure the Primitive decision and its reason are in it. Rename it **"YC hackathon
sponsor research"**. Don't record this; it's the history the story builds on.

## 3. Record (raw clips)

`screencapture -v -R x,y,w,h -V <seconds> video/raw/NN-name.mov` records one window's frame; or QuickTime for long takes.
For every clip, note in `video/shots.md`: file, shot #, start/end of the useful part, anything odd.

| Shot | Clips |
|---|---|
| 2 | `anydock.ai` scrolled to the "human as glue" cards; each card hovered/lit in turn, ~2 s each (copy-paste, an hour to show a colleague, you log off, "where did this come from?", tokens pasted) |
| 4 | Install in a throwaway HOME: `HOME=$(mktemp -d) sh -c 'curl -fsSL https://anydock.ai/install.sh \| sh'` → approve in the browser → "Done." |
| 5 | Left terminal + left browser (the doc filling in); right browser (Jason's Inbox → opens the doc → edits one section while the agent writes) — record left and right separately, same time |
| 6 | Left terminal (catch-up, Slack post, email) + the Mac approval panel (top-right; record that region) + Slack `#launch` + the email in the Outlook inbox |
| 7 | Left terminal (handover) + phone (iPhone Mirroring window) + right terminal (Jason's Codex picking up, writing the doc) + the doc updating live (either browser) + right terminal asking "why did we pick Primitive?" + dashboard jumping to the cited step |
| 8 | Left terminal (build the app) + the app page (its Permissions panel) + approval panel + clicking "Post status" + Slack `#launch` |

Use the exact prompts in DEMO.md. Type at a readable pace. Retake rather than trim around mistakes.

## 4. Voice

Preferred: Nolan reads DEMO.md's narration (one take per shot, QuickTime audio, quiet room). Otherwise give him 2–3
samples: macOS `say` (free "Enhanced/Premium" voices in System Settings → Accessibility → Spoken Content) or a local
open model such as Kokoro (no API key). No paid TTS without asking. Save as `video/voice/NN.m4a`.

## 5. Hand off to Claude

Tell Claude (in this repo's AGENTS.md Status or directly) where `video/raw/`, `video/voice/`, `video/wallpaper.png` and
`video/shots.md` are. Claude does the cut: composite on the wallpaper, split screen with labels, pain tags, title cards,
captions, timing to ≤ 2:00 → `~/Movies/AnyDock-demo.mp4`.

## Done when

- [ ] Stage set (two accounts, two agents, two Edge profiles), cleanup done, one dry run passed.
- [ ] Real seed session recorded and renamed.
- [ ] Raw clips for shots 2, 4–8 in `video/raw/`, logged in `video/shots.md`.
- [ ] Voice recorded or chosen.
- [ ] Handed to Claude for the cut.

## Production notes — Oct 18

- Codex and Claude CLIs already installed; no installation performed.
- Created an isolated Edge profile (currently “Profile 2”) without importing personal data; light appearance, AnyDock login page open. Nolan must sign in as qizi297@outlook.com; profile rename to Jason and CLI device approval remain pending. No login or approval performed by the agent.
- Free macOS English voice samples generated: `../video/voice/sample-Samantha.wav` (19.5 s), `sample-Daniel.wav` (21.1 s), `sample-Karen.wav` (20.9 s). Same excerpt at 165 words/min; Nolan's selection pending. Source text: `../video/voice/sample-script.txt`.
- No raw footage, seed session, dry run, or completed stage claimed yet.
