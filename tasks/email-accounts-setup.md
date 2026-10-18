# Task: let agents send email as the person — Gmail and Outlook OAuth apps

For: Codex (or any agent with browser access to Nolan's signed-in Google Cloud and Microsoft accounts).
Read `AGENTS.md` first. When done, tick the boxes, update the Status section of `AGENTS.md`, commit **only the files you
changed**, and push. Another agent writes the connector code — don't edit `server/src/**`.

## Why

Today an agent's email goes out from AnyDock's own sender (Primitive). Better: the person connects **their own Gmail or
Outlook once**, and agents send *as them* (same rules: teammates = allow, outside = ask me). AnyDock keeps the token
server-side; agents never see it. Proton Mail has no public OAuth send API, so it stays "coming soon".

The server code will expect these redirect URLs (being built; they don't need to exist for you to finish):
- Gmail: `https://anydock.ai/api/connectors/gmail/callback`
- Outlook: `https://anydock.ai/api/connectors/outlook/callback`

## Rules

- Paste client secrets **only** into `npx wrangler secret put …` (run in `server/`). Never into a file, commit, chat or log.
- Don't add scopes beyond the ones listed. Don't publish/verify the Google app — Testing mode is fine for the hackathon.

## Part 1 — Gmail (reuse the existing Google OAuth client)

Project `western-pivot-512023-a8`, client `AnyDock web` (already used for "Continue with Google").
1. Google Cloud Console → APIs & Services → **Library** → enable **Gmail API**.
2. Google Auth Platform → **Data Access** → Add scope `https://www.googleapis.com/auth/gmail.send` (only this one). Save.
3. Credentials → `AnyDock web` → Authorized redirect URIs: add `https://anydock.ai/api/connectors/gmail/callback` and
   `http://localhost:8787/api/connectors/gmail/callback`. Save.
4. No new secrets: the server reuses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Part 2 — Outlook (Microsoft Entra app registration)

1. https://entra.microsoft.com (or portal.azure.com) → **App registrations** → **New registration**
   - Name `AnyDock`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: platform **Web**, `https://anydock.ai/api/connectors/outlook/callback`
2. After creating: Authentication → add redirect `http://localhost:8787/api/connectors/outlook/callback`.
3. **API permissions** → Add → Microsoft Graph → **Delegated**: `Mail.Send`, `User.Read`, `offline_access`. (No admin consent needed.)
4. **Certificates & secrets** → New client secret (24 months).
5. `npx wrangler secret put MS_CLIENT_ID` → the **Application (client) ID**
6. `npx wrangler secret put MS_CLIENT_SECRET` → the secret **Value** (not the Secret ID).
7. If the Microsoft account needs a phone/2FA step or asks to create an Azure subscription, **stop and ask Nolan** — the
   app registration itself must not require a paid subscription.

## Done when

- [x] Gmail API enabled, `gmail.send` scope added (Google confirmed saved), two Gmail redirect URIs saved on existing AnyDock web client (Oct 17).
- [ ] Entra app `AnyDock` exists with the two Outlook redirect URIs and the three delegated permissions.
- [ ] Secrets `MS_CLIENT_ID`, `MS_CLIENT_SECRET` set (`npx wrangler secret list` shows the names).
- [ ] `AGENTS.md` Status updated; your commit pushed.

## Oct 17 status

Gmail configuration complete, no mailbox grant/send test yet. Outlook registration blocked: personal `qizi297@outlook.com` gets AADSTS16000 in Microsoft Services tenant. No subscription created, no admin consent granted.

Oct 17 live Gmail authorization: Nolan explicitly approved gmail.send for qizi297@gmail.com and a test to his own Outlook. Google consent completed; AnyDock shows “Agents send as qizi297@gmail.com.” Credential remains encrypted in the server connection. Actual send/delivery pending refreshed local CLI authorization.

Oct 17 Gmail end-to-end passed: approved request 621e6494-bdb3-42dc-b32a-9c87c364e20f executed from qizi297@gmail.com; Outlook connector verified actual receipt of “AnyDock Gmail end-to-end test 2026-10-17” with the exact test body. Not merely provider acceptance. CLI device login refreshed with Nolan approval; no session sync or editor configuration changed.
