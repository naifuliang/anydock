# Task: set up Inkbox (agent phone, SMS and iMessage) for AnyDock

For: Codex (or any agent with browser access to Nolan's accounts). Optional — do it after the Discord, Slack and email tasks.
Read `AGENTS.md` first. When done, tick the boxes, update the Status section of `AGENTS.md`, commit **only the files you
changed**, and push. Another agent writes the connector code — don't edit `server/src/**`.

## Why

For delegate, an agent sometimes needs to reach a person outside chat: text the teammate a work was handed to, or call
when something needs them now. Inkbox (a hackathon sponsor) gives an agent identity a phone number, SMS/iMessage and
voice. AnyDock will hold one shared identity, `anydock`, and send on a person's behalf only when their permission rule
allows it (default for calls/texts: **ask me**).

## Rules

- **Don't buy a paid plan or a phone number without asking Nolan first.** The free tier is fine to start (shared iMessage,
  limited recipients). If a step needs a paid plan, stop and tell him what it costs.
- Paste the API key **only** into `npx wrangler secret put INKBOX_API_KEY` (in `server/`). Never into a file, commit, chat or log.
- Only text or call **Nolan's own number** while testing.

## Steps

1. Sign up / sign in at https://inkbox.ai/console with Nolan's account; create an **API key** (format `ApiKey_…`).
2. `cd server && npx wrangler secret put INKBOX_API_KEY` → paste it.
3. Create the identity (CLI is easiest: `npx @inkbox/cli` needs Node 22+, which this machine has):
   - `INKBOX_API_KEY=… npx @inkbox/cli identity create anydock --display-name "AnyDock"` — set the key in that one
     command's environment only; don't export it into the shell profile.
   - If the free tier offers iMessage/SMS on the identity, enable it. If a phone number requires a paid plan, skip it and note that.
4. `npx wrangler secret put INKBOX_IDENTITY` → `anydock`, and `npx wrangler secret put INKBOX_IDENTITY_ID` → the identity's
   **UUID** (`GET https://inkbox.ai/api/v1/identities` with header `X-API-Key`, or the console). If the identity has a phone
   number, also set `INKBOX_PHONE_NUMBER_ID` → that number's UUID (used for SMS when iMessage isn't possible).
5. Test once: send a text from the `anydock` identity to Nolan's own phone ("AnyDock test — reply STOP to ignore"), confirm
   it arrives, then note in `AGENTS.md` which channels work on the current plan (SMS / iMessage / voice).
6. Write down (in `AGENTS.md`, Status) the exact REST endpoint + auth header the SDK uses for "send text", from
   https://inkbox.ai/docs/llms.txt — the connector code will call it from a Cloudflare Worker, where the SDK may not run.

## Done when

- [x] `INKBOX_API_KEY` and `INKBOX_IDENTITY_ID` set. Current connector uses the UUID directly; `INKBOX_IDENTITY` is not read by the code. No paid phone number provisioned.
- [x] Identity `anydock` exists; test message to Nolan arrived (or the paid-plan blocker is written down).
- [x] REST endpoint + header for sending a text recorded in `AGENTS.md`.
- [x] Your commit pushed.

## Oct 17 verification

Identity-scoped production key and UUID saved. Extra Quickstart key revoked. No paid number purchased. Nolan completed recipient opt-in; Messages sent START/Hello, received by Inkbox. Console reply “AnyDock test: received your hello.” arrived in Messages. Provider bilateral iMessage verified; SMS, voice and AnyDock delegate path unverified. REST: POST https://inkbox.ai/api/v1/imessage/messages?agent_identity_id=<uuid>, X-API-Key; shared service requires recipient-first contact.
