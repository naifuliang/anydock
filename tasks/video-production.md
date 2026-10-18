# Task: produce the 2-minute AnyDock demo video

For: Codex (computer use + shell). Read `AGENTS.md`, then **`DEMO.md` — it is the script** (shot list, narration,
continuity). This file is how to make it. Deadline: final MP4 well before **Oct 18, 9:30 AM PDT**.

## Rules

- **Real product only.** Every product shot is anydock.ai with the real demo accounts (DEMO.md "Cast"). Don't build fake UI.
  The only non-product footage is the landing page's own animations and the two title cards.
- **Clean frames.** Record windows only (never the full screen), composite them on Nolan's wallpaper. Turn on Do Not
  Disturb / Focus first. No other apps, no personal browser tabs or bookmarks bar, no notification banners, no tokens,
  no email addresses except the two demo accounts. Check every clip before using it.
- **Never approve as Nolan.** Touch ID / password moments (shot 9) and the phone (shot 8) need Nolan — stop and ask him;
  don't click Approve in the dashboard to fake it.
- Only message the demo accounts (qizi297@gmail.com, qizi297@outlook.com), `#general` in the demo Slack workspace, and
  Nolan's own phone. Nobody else.
- Don't edit `server/src/**`, `cli/src/**` or tests. Put working files in `~/Documents/ychackathon/video/` (outside the
  repo). Commit only this file's checkboxes / notes and `DEMO.md` timing tweaks.
- If something in the product misbehaves on camera, stop and tell Nolan (and Claude) what you saw — don't work around it.

## Stop and ask Nolan when

- macOS asks for **Screen Recording** permission (for the app you record with) — he grants it.
- Shot 8 (the iMessage on his phone, shown with iPhone Mirroring) and shot 9 (Touch ID on the panel).
- Step 2 of DEMO.md "Before recording" (Jason's second sign-in) if not done yet — it needs his browser approval.
- The voice: he either records the narration himself or picks a TTS voice from your samples.

## 1. Set up the stage

1. Focus on, Dock auto-hidden, menu bar clean (quit apps you don't need).
2. Get Nolan's wallpaper as a 2560×1600 (or screen-size) PNG, `video/wallpaper.png`, with nothing on it (from System
   Settings' wallpaper file, or a capture of the empty desktop). This is the background for every window clip.
3. Two browser profiles in Microsoft Edge: **Nolan** (anydock.ai signed in as qizi297@gmail.com) and **Jason**
   (signed in as qizi297@outlook.com). Hide the bookmarks bar; page zoom 110–125% so text reads at 1080p.
4. Terminal for Claude Code (left) and for Codex (right): font 16–18 pt, clean prompt, light theme matching the site.
5. Window layout for split shots: two windows, each exactly half of a 1920×1080 region with a small gap, so the
   composite looks deliberate.

## 2. Seed the real data (before recording)

1. In `~/Documents/ychackathon/sponsor-research` start a **new** Claude Code session and run a real, short research task:
   "Research the 8 sponsors of YC's Make Something Agents Want hackathon (Primitive, Stripe, Manufact, Inkbox, InsForge,
   Armature, Blaxel, Supabase); decide which tracks fit a tool that lets teams share and hand over agent work; recommend
   one with reasons and sources." Rename it **"YC hackathon sponsor research"**. This is the session shots 4–8 use.
2. Make sure the "Primitive" decision and its reason are in that session (shot 6 asks why).
3. Delete leftovers from testing in Nolan's account (the "Container smoke test" artifact, any test works) so lists look real.
4. Do one full dry run of shots 4–9 without recording; then reset what you can (e.g. use a fresh doc title per take).

## 3. Record

Tools: macOS `screencapture -v -R x,y,w,h -V <seconds> clip.mov` records a screen region (the window's frame) with no
other UI; or QuickTime for long takes. 30 fps is fine. Name clips `video/raw/NN-short-name.mov`.

- **Shot 2 (ANIM):** record `https://anydock.ai/` scrolled to the "human as glue" cards (hover/scroll so each card is
  lit in turn), and `https://anydock.ai/?scene=5` and `?scene=8` (each holds one hero scene and plays its animation;
  record ~9 s from load).
- **Shot 3:** in a throwaway HOME so it doesn't touch the real install:
  `HOME=$(mktemp -d) sh -c 'curl -fsSL https://anydock.ai/install.sh | ANYDOCK_NO_SETUP=1 sh'` then show
  `anydock login` approving in the browser. Speed up 4× in the edit. (Or record Nolan's real `anydock setup` output
  if he prefers — no secrets are printed either way.)
- **Shots 4–9:** exactly the prompts in DEMO.md, typed at a readable pace. Keep each take short; record left and right
  windows as separate clips when both matter, and composite them side by side.
- **Shot 7:** the agent opens the doc in the built-in browser / AnyDock window; while it fills, Jason (in his profile)
  clicks Edit on one section so his colour and "Jason is editing" show. Then 2-s captures of a deck (Present), a sheet
  with a total, and a running app (from Nolan's artifacts).
- **Shot 9:** Nolan presses **This session** + Touch ID. Then record the second action running without asking, and the
  sent email in Gmail (Jason's/Outlook inbox shows it arriving is fine).

## 4. Voice

Preferred: Nolan reads the DEMO.md narration (QuickTime audio, one take per shot). Otherwise make 2–3 TTS samples for
him to pick from: macOS `say -v Samantha` (built in; better "Enhanced/Premium" voices can be downloaded free in System
Settings → Accessibility → Spoken Content), or a local open model such as Kokoro (no API key, runs on the Mac).
No paid TTS without asking.

## 5. Edit

- ffmpeg isn't installed system-wide: use a self-contained binary in `video/tools/` (e.g. `npm i ffmpeg-static` there),
  don't install with Homebrew without asking.
- Composite each window clip centred on `wallpaper.png` with a soft shadow; 1920×1080 output, H.264, yuv420p.
- Title cards (shots 1 and 10): white, the site's fonts (Geist + Instrument Serif italic for "10x"), text from DEMO.md.
- Burn in captions from the narration (one line at a time, bottom, white on translucent dark). Light music under the
  voice only if it doesn't fight it.
- Final: `~/Movies/AnyDock-demo.mp4`, **≤ 2:00** (check with ffprobe), plus a 10-s preview GIF/MP4 for the README if time allows.

## Done when

- [ ] Stage set, wallpaper captured, two browser profiles signed in.
- [ ] Seed session recorded and renamed; test leftovers removed.
- [ ] All shots recorded (list any retakes needed).
- [ ] Voice chosen and recorded/generated.
- [ ] `~/Movies/AnyDock-demo.mp4` exported, ≤ 2:00, reviewed by Nolan.
