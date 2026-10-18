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

- macOS asks for **Screen Recording** permission.
- Shots 6 and 8 (Touch ID) and 7 (the phone, via iPhone Mirroring).
- The voice: he records the narration, or picks one of your TTS samples.
- Any sign-in, password, 2FA or device-login approval (both CLI identities are already signed in — see 1.1).

Everything else in section 1 is yours to do.

## 1. Stage (one Mac, two people) — you do all of this

Status Oct 18 ~3 AM: the Codex CLI is installed (0.163.0, `codex --version`); both AnyDock identities are signed in and
isolated (Keychain fix shipped); Jason's display name is "Jason"; Edge profile 2 is "Jason".

1. **Check identities.** `anydock whoami` → qizi297@gmail.com; `ANYDOCK_HOME=~/.anydock-jason anydock whoami` →
   qizi297@outlook.com. If either is wrong, stop and tell Nolan + Claude.
2. **Jason's Codex** (separate from Nolan's normal Codex):
   `mkdir -p ~/.codex-jason/skills && cp ~/.codex/auth.json ~/.codex-jason/ && cp -R ~/.codex/skills/anydock ~/.codex-jason/skills/`,
   then write `~/.codex-jason/config.toml`:
   ```toml
   [mcp_servers.anydock]
   command = "/Users/nolanliang/.anydock/bin/anydock"
   args = ["mcp"]
   env = { ANYDOCK_HOME = "/Users/nolanliang/.anydock-jason", CODEX_HOME = "/Users/nolanliang/.codex-jason" }
   ```
   Start it with `CODEX_HOME=~/.codex-jason codex` and check the AnyDock tools are listed (`/mcp`). Don't touch `~/.codex`.
3. **Team project** (so agents can say "share it with Jason"): in Edge profile **Nolan** → anydock.ai/app → Projects →
   create **"YC hackathon"** → add member **qizi297@outlook.com**. Confirm it shows in profile **Jason** too.
4. **Jason's profile:** profile **Jason** → Permissions → **You**: name "Jason" (already), phone = Nolan's number
   (ask Nolan for it if you don't have it — never guess), check "Text me when work is handed to me", Save.
5. **Slack:** in Nolan's demo workspace ("New Workspace"), create channel **#launch** if it doesn't exist (no apps, no invites).
6. **Cleanup:** in profile **Nolan** → Artifacts → open "Container smoke test (safe to delete)" → Share → **Delete**.
   Remove any other test leftovers from both accounts' Works / Artifacts lists the same way.
7. **Nolan's rules:** Permissions → "Email people outside the team" = Ask me, "Post in Slack as you" = Allow (check only).
8. **Dry run** the whole story once without recording (DEMO.md shots 4–9), including one Touch ID panel with Nolan.
   Fix nothing in the product yourself — report anything odd.
9. Focus on, Dock hidden, quit unrelated apps. Save Nolan's wallpaper as `video/wallpaper.png` (screen resolution,
   nothing on it).
10. Edge: bookmarks bar off, zoom 110–125% in both profiles; every recorded page in its own single-page window.
11. Terminals: left = Nolan's Claude Code (`~/Documents/ychackathon/sponsor-research`), right = Jason's Codex
    (`CODEX_HOME=~/.codex-jason codex`). 16–18 pt font, light theme, short prompt.
12. Fixed layout: each recorded window exactly 960×1080 (split shots) or 1920×1080 (full shots), always the same
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
- [x] Real seed session recorded and renamed (d4da0d79-029c-48c9-8e1c-23b3057c60f7).
- [ ] Raw clips for shots 2, 4–8 in `video/raw/`, logged in `video/shots.md`.
- [ ] Voice recorded or chosen (Nolan will read; recording pending).
- [ ] Handed to Claude for the cut.

## Production notes — Oct 18

- Codex and Claude CLIs already installed; no installation performed.
- Created an isolated Edge profile (currently “Profile 2”) without importing personal data; light appearance, AnyDock login page open. Nolan must sign in as qizi297@outlook.com; profile rename to Jason and CLI device approval remain pending. No login or approval performed by the agent.
- Free macOS English voice samples generated: `../video/voice/sample-Samantha.wav` (19.5 s), `sample-Daniel.wav` (21.1 s), `sample-Karen.wav` (20.9 s). Same excerpt at 165 words/min; Nolan's selection pending. Source text: `../video/voice/sample-script.txt`.
- No raw footage, seed session, dry run, or completed stage claimed yet.

### Qwen3-TTS voice audition

- Nolan rejected the macOS system voices for unnatural pauses; Kokoro audition delivered, then Nolan requested Qwen3-TTS with natural rhythm and emotion. No final voice chosen.
- Local Qwen3-TTS 1.7B CustomVoice 6-bit ran successfully through MLX on this M2 / 16 GB Mac; both weight files matched the publisher's SHA-256 after the interrupted download was retried. No paid service used.
- New auditions: `../video/voice/qwen-warm.wav` (Ryan, 26.32 s, warm conversational storytelling) and `../video/voice/qwen-confident.wav` (Aiden, 16.72 s, brighter product-demo delivery). Same excerpt, continuous model generation with style instructions. Peak amplitudes 0.723 / 0.555, below clipping. Nolan's listening judgment is pending.
- Full narration, Jason sign-in, staging, seed session and raw footage are still pending.

### Full Aiden narration — selected by Nolan

- Nolan chose Aiden and authorized faster pacing and more expressive emotion. Generated all nine narration passages from the current `DEMO.md` with Qwen3-TTS, Aiden, locally. Spoken-only normalizations: ten-x → ten X, AnyDock → Any Dock, #launch → launch.
- Complete listening preview: `../video/voice/aiden-full-v1/AnyDock-Aiden-full.m4a` (75.096 s). This is a continuous audition; final picture timing is not locked.
- Editable shot masters: `../video/voice/aiden-full-v1/01.wav` through `09.wav` (24-bit WAV), with M4A copies. Canonical `../video/voice/01.m4a` through `09.m4a` also populated. Raw model takes retained in the version folder.
- Cut handoff bundle: `../video/voice/AnyDock-Aiden-voice-pack.zip`; includes all shot files, preview, exact narration and timing notes, and `timing.json`. Shot durations: 1.995 / 10.640 / 4.160 / 1.360 / 6.715 / 13.200 / 14.720 / 11.995 / 6.560 s. Shot 02 needs about 0.64 s from the following title card if keeping the script timeline.
- Validation: every delivered audio file decodes and peaks below clipping; full-preview local ASR covers all nine sections without repeated outros. Short-clip ASR produced hallucinated tails, so those were not treated as spoken content. Proper-name recognition remains imperfect; subjective performance approval is Nolan's listening decision.
- Voice pack ready for the eventual cut; no direct message to Claude sent. Jason login, stage, seed session, dry run and raw footage remain pending.

### Recording preparation resumed — Nolan voice and isolated windows

- Nolan decided to read the narration himself; TTS is superseded. Existing samples and full Aiden pack retained. Root `video/voice/01.m4a`–`09.m4a` TTS copies moved into `video/voice/tts-placeholder-superseded/` so they cannot be mistaken for Nolan's final narration.
- Nolan requires a separate window for every recording target, with one demo page per browser window and no unrelated tabs. Use separate windows for dashboards, artifacts, Slack/mail and terminals as needed.
- Opened a new clean single-tab Nolan AnyDock window; UI confirms qizi297@gmail.com signed in. Jason has a separate single-tab login window in Edge Profile 2, email qizi297@outlook.com entered; Nolan must complete sign-in. No login or approval performed by the agent.
- Stopped at the explicit Jason-login handoff. Screen recording, stage layout, dry run and raw clips have not started.

### Jason account and browser identity verified

- Nolan completed qizi297@outlook.com web sign-in. Changed its AnyDock display name from Naifu Liang to Jason; verified after reload. Renamed Edge Profile 2 to Jason through browser settings and closed the temporary settings window. Main Gmail account was also observed displaying Nolan.
- Started isolated AnyDock CLI login with `ANYDOCK_HOME=~/.anydock-jason`. Opened a separate single-page authorization window in Edge Jason and entered its device code. Stopped before Continue/Approve for Nolan; CLI authorization remains pending.

### Recording blocker — CLI account isolation

- Nolan completed Jason's device authorization. Isolated login succeeded as qizi297@outlook.com.
- Before seeding or recording, explicit `ANYDOCK_HOME=/Users/nolanliang/.anydock` and `ANYDOCK_HOME=/Users/nolanliang/.anydock-jason` calls to `anydock whoami` BOTH returned qizi297@outlook.com. Local config user emails remain Gmail and Outlook respectively; both use `tokenStore: keychain`.
- Read-only diagnosis: `cli/src/config.ts` passes only the server URL to `readToken`/`writeToken`; `cli/src/secret.ts` uses fixed service `ai.anydock.cli` and that server URL as the Keychain account. The two homes therefore share a credential entry despite separate config folders. Jason login overwrote the shared credential used by Nolan.
- Stopped production under the product-misbehavior rule; no credential workaround or product-code change performed. Fix and verify home-scoped Keychain isolation before resuming; Nolan may need to reauthorize his CLI afterward. No raw clips or seed session created.
- Every recording page must continue to use its own separate single-page window, per Nolan's reiterated requirement.

### Preparation resumed after identity fix

- Verified explicit default and Jason homes return qizi297@gmail.com and qizi297@outlook.com respectively. Previous Keychain isolation blocker is resolved.
- Prepared isolated ~/.codex-jason auth copy, AnyDock skill and config with both ANYDOCK_HOME and CODEX_HOME on the MCP. `codex mcp list` shows AnyDock enabled; interactive /mcp still pending.
- Created YC hackathon project (adc2dc7c-a3f7-43f6-aee4-65e7fd3d78ea), added Jason, and verified the project appears in Jason's browser with 2 members.
- Set Jason's handover phone to Nolan's existing saved profile number and enabled handover texts; UI confirmed Saved. Phone is intentionally not copied into this log.
- Nolan's permission page visually confirms Slack Allow, external email Ask me, Slack connected to New Workspace and Gmail connected to the demo Gmail account. Jason demo window is single-tab Inbox at 110% zoom.
- Seed attempt via a new named Claude Code session stopped with `Failed to authenticate: OAuth session expired and could not be refreshed`. No research completed, no false seed completion claimed. Nolan must reauthenticate Claude Code before retrying.
- Computer-use tool explicitly rejected Terminal with `Computer Use is not allowed to use the app 'com.apple.Terminal' for safety reasons.` No alternate UI automation used to bypass it. Asked Nolan to prepare two independent terminal windows.
- Remaining: Claude sign-in, interactive agent checks, Slack #launch, test-artifact cleanup, Focus/layout/wallpaper, full dry run with Nolan, all raw clips and narration. No recordings yet.


### First live recording attempt — cards delegated to Claude

- Nolan explicitly assigned all cards/title animation/landing material to Claude; Codex records only real product operations (shots 4–8). Do not record or extract landing cards.
- Claude CLI login verified. Completed real named seed session d4da0d79-029c-48c9-8e1c-23b3057c60f7 with 16 WebSearch and 10 WebFetch calls. Findings: ../video/seed-research.txt. Primitive recommended on thematic fit with caveats about unverified judging rules.
- Screen Recording access verified; Do Not Disturb visibly On. Window-ID video capture tested while another app covered Edge: captures target window without occluding app. Overlapping windows are workable. Preflight retained separately, not final footage.
- Nolan resumed seed in a standalone Claude terminal and sent the exact create/share prompt. Claude created doc 7f544e1d-4be3-4067-bf7f-afda00f4c113, title YC Make Something Agents Want: Sponsor Recommendation; independent native viewer opened.
- Product issue observed during recording: Jason Inbox live toast read `Nolan shared “undefined”`, then sidebar Inbox badge became 1. Stopped under the report-product-misbehavior rule. No code fixes or UI workarounds performed.
- Capture mistake: SIGINT stopped the three action recordings without finalizing movies (exit 130). They are NOT delivered footage and require retakes. Use short timed recordings that end naturally. Only ../video/raw/05-jason-inbox-before-share.mov finalized (6.033 s, 2940×1724; opening plate only).
- Handoff log: ../video/shots.md. Raw actions 4–8, dry run, cleanup and voice remain incomplete.
