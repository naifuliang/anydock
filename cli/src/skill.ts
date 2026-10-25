import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { COMMAND } from "./version.ts";

// The AnyDock skill, installed next to the MCP server into Claude Code (~/.claude/skills) and Codex (~/.codex/skills).
// The MCP tools give agents the capability; the skill teaches the workflow — and how to show artifacts to the person.
const CLAUDE_SKILLS = join(homedir(), ".claude", "skills");
const CODEX_SKILLS = join(process.env.ANYDOCK_CODEX_HOME ?? process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills");

function skill(cli: string): string {
  return `---
name: anydock
description: Share and hand over agent work, and make live documents, slide decks, spreadsheets, LaTeX, web pages and small apps (AnyDock artifacts) that teammates and their agents can open, co-edit, share and take over. Use when the user wants a doc/report/deck/sheet/page/app made, shared with or handed to someone, or asks what a teammate sent or why a decision was made.
---

# AnyDock

AnyDock is the team's shared workspace for agent work. Two ways to use it — same features, pick whichever is handier:
- MCP tools \`anydock_*\` (already connected), or
- the CLI: \`${cli}\` (run \`${cli} help\`).

## Making something the user will read, edit or pass on → an artifact

When the user asks for a document, report, plan, memo, deck, spreadsheet, LaTeX paper, web page or small app — and
especially when someone else will read, edit or take it over — make it an AnyDock artifact instead of a loose local file.

1. **Skeleton first.** Create it with an outline, one entry per section or slide (\`"Heading: what goes here"\`):
   - MCP: \`anydock_artifact_create\` with \`title\`, \`type\` (doc | slides | sheet | latex | html), \`outline\`
   - CLI: \`${cli} artifact create "Launch plan" --type doc --outline "# Launch plan: one-line goal|Timeline: key dates|Risks"\`
2. **Show it right away — visibly**, so the user watches it fill in. The create result includes a one-time sign-in link.
   - **Claude desktop app (Code tab):** open that link with your browser tool, then bring the browser pane to the front
     (show the browser pane) — opening it alone can leave the pane hidden. The link signs the pane in; it works once,
     within 2 minutes. Need another? \`anydock_artifact_open id=… where=builtin\` (CLI: \`${cli} open <id> --link\`).
   - **Codex app:** open the link in the in-app browser and make sure it's visible.
   - **No built-in browser** (terminal): \`anydock_artifact_open id=…\` / \`${cli} open <id>\` — a native window on a Mac,
     already signed in; elsewhere the default browser.
   - Never paste the one-time link to other people; share the artifact's normal URL (or \`anydock_artifact_share\`).
3. **Fill it section by section** — one write per section, in order:
   - MCP: \`anydock_artifact_write\` with \`id\`, \`section\` (number or heading), \`content\` (Markdown body, no heading line)
   - CLI: \`${cli} artifact write <id> 2 --file section.md\` (or \`--content "…"\`, or \`-\` for stdin)
   If a section is locked, a person is editing it: skip it, do the others, come back later.
4. Re-read before changing something a person may have edited: \`anydock_artifact_read\` / \`${cli} artifact read <id>\`.

Formats:
- **doc** — Markdown sections (tables, code, quotes). Exports to .docx, .md, PDF.
- **slides** — one section per slide: heading = slide title, body = short Markdown bullets. Exports to .pptx.
- **sheet** — write CSV for a tab; formulas like \`=SUM(B2:B9)\` work. Exports to .xlsx/.csv.
- **latex** — full source; the page typesets it live. Upload a compiled PDF too if you have one.
- **html** — a single self-contained page; it runs sandboxed with a live preview.
- **Small apps** — write the files to a folder with index.html, then \`anydock_artifact_upload path=<folder>\`
  (\`${cli} artifact upload ./dist\`). Upload again with \`id\` for a new version.
- **Word / PowerPoint / Excel / PDF / images you generated** — \`anydock_artifact_upload path=<file>\`; the user previews
  them in the browser and can turn Office files into live docs/decks/sheets.

## Apps with a backend (and permissions that only narrow)

An app's page can load \`<script src="_anydock.js"></script>\` (a relative path) and use \`window.anydock\`:
- \`anydock.data.set(collection, key, value)\` / \`get\` / \`list(collection)\` / \`delete\` — a shared data store for the app
  (everyone using it sees the same data). Use this instead of localStorage for anything the team shares.
  Values up to 1 MB, 50,000 per app.
- \`await anydock.files.put(name, blob, type?)\` → \`{name, size, url}\` · \`files.list(prefix?)\` · \`files.get(name)\` (Blob) ·
  \`files.url(name)\` · \`files.delete(name)\` — file storage for recordings, photos and attachments (≤100 MB each, 2 GB per
  app); \`url\` plays directly in \`<audio>\`/\`<video>\`/\`<img>\` and seeks. Folders with "/" in the name. The app frame
  may use the microphone and camera (\`getUserMedia\` + \`MediaRecorder\`, then \`files.put\`).
- \`await anydock.mode()\` → "edit" (people with access) · "view" (a public link: read-only) · "submit" (a public link
  while the owner accepts submissions: may add *new* keys and files, never overwrite or delete). Adapt the UI (hide edit
  controls in "view"; use fresh keys like \`crypto.randomUUID()\` for submissions). Only the owner turns submissions on,
  from the artifact page — you can't.
- \`await anydock.call("slack.post", {to, text})\` · \`("email", {to, subject, body})\` · \`("text", {to, text})\` — act
  through AnyDock. Only works for what the app was granted, and the user's rules still apply (it may wait for approval).
- Server code: put \`server.js\` (listening on \`process.env.PORT\`) or a \`package.json\` with a start script in the app
  folder. It runs in a sandbox; the page reaches it with \`anydock.backend("path")\`. From the server, call AnyDock the same
  way over HTTP at \`process.env.ANYDOCK_APP_URL\` + \`_api/data/…\` / \`_api/call\` — there is no token to hold.

Permissions flow person → agent → app, and each step can only narrow. To let an app act, ask for exactly what it needs:
\`anydock_app_grant id=<app> actions=["slack.post"] to=["#launch"] days=7\` (CLI: \`${cli} artifact grant <app> slack.post --to "#launch" --days 7\`).
You can only grant what your rules allow, and every grant waits for the user's approval (Touch ID / password, dashboard,
or Slack). Never try to work around a refusal.

To let anyone view an artifact without signing in (a public, read-only link): \`anydock_artifact_publish id=<artifact>\`
(CLI: \`${cli} artifact publish <id>\`). It asks the user first; the result has the public URL to open or pass on.
Turn it off with \`off=true\` (\`--off\`) — that never needs approval.

To delete an artifact: \`anydock_artifact_delete id=<artifact>\` (CLI: \`${cli} artifact delete <id>\`). Only ones the user
owns; it always waits for the user's approval, because it's gone for everyone.

## Passing work on

- Share an artifact: \`anydock_artifact_share id=… to=email\` (\`role: viewer\` for read-only); hand it over with
  \`handover: true\` (they become the owner, with its history).
- Share or hand over the whole session (context, trajectory, artifacts made in it): \`anydock_share\` /
  \`anydock_handover\`.
- What did teammates send: \`anydock_inbox\`. Why was something decided: \`anydock_ask_why\`.

## This session's permissions

Each agent session has its own permissions: the user's rules, narrowed for this session or widened for it only by the
user (e.g. "This session" when they approve). \`anydock_permissions\` shows what this session may do; pass \`restrict\` to
tighten it yourself when the task calls for it (a research-only session that must not message anyone).

## Rules

- Never ask for, print or paste tokens or passwords. AnyDock holds every credential; you never need one.
- Actions that reach people (Slack, email, texts) follow the user's rules; some wait for their approval on their Mac or
  in AnyDock. Don't retry a denied action unless they ask.
`;
}

const cliPath = () => (COMMAND.length === 1 ? COMMAND[0]! : "anydock");

export function installSkills(): string[] {
  const done: string[] = [];
  for (const [name, dir] of [["Claude Code", CLAUDE_SKILLS], ["Codex", CODEX_SKILLS]] as const) {
    if (!existsSync(join(dir, ".."))) continue; // that agent isn't installed
    mkdirSync(join(dir, "anydock"), { recursive: true });
    writeFileSync(join(dir, "anydock", "SKILL.md"), skill(cliPath().replace(homedir(), "~")));
    done.push(name);
  }
  return done;
}

export function uninstallSkills(): void {
  for (const dir of [CLAUDE_SKILLS, CODEX_SKILLS]) rmSync(join(dir, "anydock"), { recursive: true, force: true });
}
