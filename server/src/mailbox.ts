import { Hono } from "hono";
import { decryptToken, encryptToken, readState, signState } from "./secure.ts";
import type { AppEnv, Env, User } from "./types.ts";

// "Email as you": a person connects their own Gmail or Outlook once; agents' emails then go out from that mailbox.
// Only a refresh token is stored (AES-GCM encrypted); access tokens are minted per send. Agents never see either.
export const mailbox = new Hono<AppEnv>();

export type MailProvider = "gmail" | "outlook";

const cfg = (env: Env) => ({
  gmail: {
    ready: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    authorize: env.GOOGLE_OAUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
    token: env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
    api: env.GMAIL_API ?? "https://gmail.googleapis.com",
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scope: "openid email https://www.googleapis.com/auth/gmail.send",
  },
  outlook: {
    ready: Boolean(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET),
    authorize: `${env.MS_LOGIN_URL ?? "https://login.microsoftonline.com"}/common/oauth2/v2.0/authorize`,
    token: `${env.MS_LOGIN_URL ?? "https://login.microsoftonline.com"}/common/oauth2/v2.0/token`,
    api: env.MS_GRAPH_API ?? "https://graph.microsoft.com",
    clientId: env.MS_CLIENT_ID,
    clientSecret: env.MS_CLIENT_SECRET,
    scope: "offline_access User.Read Mail.Send",
  },
});

export const mailboxReady = (env: Env) => ({ gmail: cfg(env).gmail.ready, outlook: cfg(env).outlook.ready });
const now = () => new Date().toISOString();
const redirectUri = (url: string, p: MailProvider) => new URL(`/api/connectors/${p}/callback`, url).toString();

async function tokenCall(url: string, params: Record<string, string>) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const data = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok || data.error) throw new Error(`token: ${data.error_description ?? data.error ?? res.status}`);
  return data;
}

// The mailbox an agent's email should go out from: the person's most recently connected one.
export async function connectedMailbox(env: Env, userId: string) {
  return env.DB.prepare(`select * from "connection" where "userId" = ?1 and "provider" in ('gmail','outlook') order by "updatedAt" desc limit 1`)
    .bind(userId)
    .first<{ id: string; provider: MailProvider; label: string; accessToken: string }>();
}

export async function mailboxStatus(env: Env, userId: string) {
  const { results } = await env.DB.prepare(`select "provider", "label" from "connection" where "userId" = ?1 and "provider" in ('gmail','outlook')`)
    .bind(userId)
    .all<{ provider: MailProvider; label: string }>();
  const ready = mailboxReady(env);
  const of = (p: MailProvider) => ({ available: ready[p], connected: results.some((r) => r.provider === p), label: results.find((r) => r.provider === p)?.label ?? null });
  return { gmail: of("gmail"), outlook: of("outlook") };
}

const b64urlStr = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

// Send from the person's own mailbox. Returns null when they haven't connected one (caller falls back).
export async function sendAsUser(env: Env, user: User, mail: { to: string; subject: string; body: string }): Promise<{ ok: boolean; detail: string } | null> {
  const box = await connectedMailbox(env, user.id);
  if (!box) return null;
  const c = cfg(env)[box.provider];
  const refresh = await decryptToken(env.BETTER_AUTH_SECRET, box.accessToken);
  const body = `${mail.body}\n\n— sent by my agent via AnyDock`;
  try {
    const tok = await tokenCall(c.token, {
      client_id: c.clientId!,
      client_secret: c.clientSecret!,
      grant_type: "refresh_token",
      refresh_token: refresh,
      ...(box.provider === "outlook" ? { scope: c.scope } : {}),
    });
    // Microsoft rotates refresh tokens; keep the newest.
    if (tok.refresh_token && tok.refresh_token !== refresh) {
      await env.DB.prepare(`update "connection" set "accessToken" = ?2, "updatedAt" = ?3 where "id" = ?1`)
        .bind(box.id, await encryptToken(env.BETTER_AUTH_SECRET, tok.refresh_token), now())
        .run();
    }
    let res: Response;
    if (box.provider === "gmail") {
      const raw = [
        `From: ${box.label}`,
        `To: ${mail.to}`,
        `Subject: =?UTF-8?B?${b64(mail.subject)}?=`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        b64(body),
      ].join("\r\n");
      res = await fetch(`${c.api}/gmail/v1/users/me/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: b64urlStr(raw) }),
      });
    } else {
      res = await fetch(`${c.api}/v1.0/me/sendMail`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { subject: mail.subject, body: { contentType: "Text", content: body }, toRecipients: [{ emailAddress: { address: mail.to } }] },
          saveToSentItems: true,
        }),
      });
    }
    if (!res.ok) return { ok: false, detail: `${box.provider === "gmail" ? "Gmail" : "Outlook"} refused to send (${res.status}).` };
    return { ok: true, detail: `Emailed ${mail.to} from ${box.label}.` };
  } catch (e) {
    return { ok: false, detail: `Couldn't use your ${box.provider === "gmail" ? "Gmail" : "Outlook"}: ${(e as Error).message}. Reconnect it in Permissions.` };
  }
}

// ---------- connect / disconnect ----------

for (const provider of ["gmail", "outlook"] as const) {
  mailbox.get(`/connectors/${provider}/start`, async (c) => {
    const user = c.get("session")?.user;
    if (!user) return c.redirect("/login?next=/app%23/permissions");
    const p = cfg(c.env)[provider];
    if (!p.ready) return c.text(`${provider === "gmail" ? "Gmail" : "Outlook"} isn't configured on this server yet.`, 503);
    const url = new URL(p.authorize);
    url.searchParams.set("client_id", p.clientId!);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", redirectUri(c.req.url, provider));
    url.searchParams.set("scope", p.scope);
    url.searchParams.set("state", await signState(c.env.BETTER_AUTH_SECRET, { u: user.id, p: provider }));
    if (provider === "gmail") {
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("login_hint", user.email);
    } else {
      url.searchParams.set("prompt", "select_account");
    }
    return c.redirect(url.toString());
  });

  mailbox.get(`/connectors/${provider}/callback`, async (c) => {
    const user = c.get("session")?.user;
    if (!user) return c.redirect("/login?next=/app%23/permissions");
    const state = await readState<{ u: string; p: string }>(c.env.BETTER_AUTH_SECRET, c.req.query("state") ?? "");
    if (!state || state.u !== user.id || state.p !== provider) return c.text("This link expired. Connect your mailbox again from Permissions.", 400);
    const code = c.req.query("code");
    if (!code) return c.redirect(`/app#/permissions?${provider}=cancelled`);
    const p = cfg(c.env)[provider];
    let tok: Record<string, any>;
    try {
      tok = await tokenCall(p.token, {
        client_id: p.clientId!,
        client_secret: p.clientSecret!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(c.req.url, provider),
        ...(provider === "outlook" ? { scope: p.scope } : {}),
      });
    } catch (e) {
      return c.text(`Couldn't connect: ${(e as Error).message}`, 400);
    }
    if (!tok.refresh_token) return c.text("No offline access was granted; try connecting again.", 400);
    // Which address did they connect? Gmail: the id_token's email; Outlook: Graph /me.
    let address = "";
    if (provider === "gmail" && tok.id_token) {
      try {
        address = JSON.parse(atob(String(tok.id_token).split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))).email ?? "";
      } catch {}
    } else if (provider === "outlook") {
      const me = await fetch(`${p.api}/v1.0/me`, { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json()).catch(() => ({})) as Record<string, string>;
      address = me.mail || me.userPrincipalName || "";
    }
    const ts = now();
    await c.env.DB.prepare(
      `insert into "connection" ("id","userId","provider","externalId","label","accessToken","botToken","scopes","createdAt","updatedAt")
       values (?1,?2,?3,?4,?5,?6,null,?7,?8,?8)
       on conflict ("userId","provider") do update set "externalId" = excluded."externalId", "label" = excluded."label",
         "accessToken" = excluded."accessToken", "scopes" = excluded."scopes", "updatedAt" = excluded."updatedAt"`,
    )
      .bind(crypto.randomUUID(), user.id, provider, address || null, address || (provider === "gmail" ? "Gmail" : "Outlook"),
        await encryptToken(c.env.BETTER_AUTH_SECRET, tok.refresh_token), tok.scope ?? p.scope, ts)
      .run();
    return c.redirect(`/app#/permissions?${provider}=connected`);
  });

  mailbox.delete(`/connectors/${provider}`, async (c) => {
    const user = c.get("session")?.user;
    if (!user) return c.json({ error: "unauthorized" }, 401);
    await c.env.DB.prepare(`delete from "connection" where "userId" = ?1 and "provider" = ?2`).bind(user.id, provider).run();
    return c.json({ ok: true });
  });
}
