import { Hono, type Context } from "hono";
import { z } from "zod";
import { E164, phoneForEmail, sendText, textingReady } from "./inkbox.ts";
import { mailboxStatus, sendAsUser } from "./mailbox.ts";
import { publish } from "./hub.ts";
import { decryptToken, encryptToken, hmacHex, readState, sameString, signState } from "./secure.ts";
import { isAgent, verifyDeviceApproval } from "./trust.ts";
import type { AppEnv, Env, User } from "./types.ts";

// Delegate: an agent asks AnyDock to do something as its person (post in Slack, send an email). AnyDock checks that
// person's rule for the action — allow, ask me, or deny — and only then performs it with tokens the agent never sees.
// Every request is stored (actionRequest) so it doubles as the approval queue and the audit log.
export const delegate = new Hono<AppEnv>();

type Decision = "allow" | "ask" | "deny";
export type ActionKey = "slack.post" | "email.internal" | "email.external" | "phone.text" | "phone.call" | "money.spend" | "github.push_main" | "app.grant" | "artifact.delete";

export const ACTIONS: Record<ActionKey, { label: string; sub: string; def: Decision; live: boolean }> = {
  "slack.post": { label: "Post in Slack as you", sub: "Channels you're in, DMs to teammates", def: "allow", live: true },
  "email.internal": { label: "Email teammates", sub: "Same company domain as you", def: "allow", live: true },
  "email.external": { label: "Email people outside the team", sub: "Any other address", def: "ask", live: true },
  "phone.text": { label: "Text a person", sub: "iMessage / SMS through Inkbox", def: "ask", live: true },
  "phone.call": { label: "Call a person", sub: "Voice through Inkbox", def: "ask", live: false },
  "money.spend": { label: "Spend money", sub: "Stripe", def: "deny", live: false },
  "github.push_main": { label: "Push to main", sub: "GitHub", def: "deny", live: false },
  // Granting is itself a permission: handing some of an agent's powers to an app always needs the person.
  "app.grant": { label: "Let an app act for you", sub: "Give an app some of your agent's permissions — always asks", def: "ask", live: true },
  // Deleting is final for everyone, so an agent can only ask; only artifacts you own.
  "artifact.delete": { label: "Delete your artifacts", sub: "Docs, decks, sheets and apps you own — always asks", def: "ask", live: true },
};

// Actions that can never be pre-allowed — not by a rule, not "for this session".
export const ALWAYS_ASK = new Set<ActionKey>(["app.grant", "artifact.delete"]);

// What an app can be given: only real actions, never the power to grant.
export const GRANTABLE = ["slack.post", "email.internal", "email.external", "phone.text"] as const;
export type Grantable = (typeof GRANTABLE)[number];

const now = () => new Date().toISOString();
const slackApi = (env: Env) => env.SLACK_API ?? "https://slack.com/api";
const slackReady = (env: Env) => Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_SIGNING_SECRET);
const BOT_SCOPES = "chat:write,im:write,users:read,users:read.email";
const USER_SCOPES = "chat:write,channels:read,groups:read,im:write,users:read,users:read.email";
// Webmail domains are never "the team".
const PUBLIC_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "yahoo.com", "proton.me", "protonmail.com", "qq.com", "163.com"]);

export interface ActionRow {
  id: string;
  source?: string | null;
  sessionId?: string | null;
  cliSessionId?: string | null;
  userId: string;
  agent: string | null;
  action: ActionKey;
  payload: string;
  summary: string;
  status: "pending" | "approved" | "denied" | "blocked" | "executed" | "failed";
  decision: Decision;
  decidedVia: string | null;
  result: string | null;
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
}

export const actionJson = (r: ActionRow) => ({
  ...r,
  payload: JSON.parse(r.payload),
  result: r.result ? JSON.parse(r.result) : null,
  label: ACTIONS[r.action]?.label ?? r.action,
});

function signedIn(c: Context<AppEnv>): User | null {
  return c.get("session")?.user ?? null;
}

export async function decisionFor(db: D1Database, userId: string, action: ActionKey): Promise<Decision> {
  const row = await db.prepare(`select "decision" from "policy" where "userId" = ?1 and "action" = ?2`).bind(userId, action).first<{ decision: Decision }>();
  const d = row?.decision ?? ACTIONS[action].def;
  return ALWAYS_ASK.has(action) && d === "allow" ? "ask" : d;
}

export type AgentSessionRef = { source: string; sessionId: string };
const SESSION_HOURS = 8;
const RANK: Record<Decision, number> = { allow: 0, ask: 1, deny: 2 };

// The decision for one agent session: the person's rule, narrowed by that session's rule — or, only if the person
// approved "for this session", allowed there (never beyond a deny, never for granting to apps, only in scope).
export async function effectiveDecision(db: D1Database, userId: string, action: ActionKey, session: AgentSessionRef | null, cliSessionId: string | null, to?: unknown):
  Promise<{ decision: Decision; sessionRule?: string }> {
  const person = await decisionFor(db, userId, action);
  if (person === "deny" || !session) return { decision: person };
  const r = await db.prepare(
    `select "id","decision","scope" from "sessionRule" where "userId" = ?1 and "source" = ?2 and "sessionId" = ?3 and "action" = ?4
       and "revokedAt" is null and "expiresAt" > ?5 and ("cliSessionId" is null or "cliSessionId" = ?6) order by "createdAt" desc limit 1`,
  ).bind(userId, session.source, session.sessionId, action, now(), cliSessionId).first<{ id: string; decision: Decision; scope: string | null }>();
  if (!r) return { decision: person };
  if (r.decision === "allow") {
    if (ALWAYS_ASK.has(action)) return { decision: person };
    const scope = r.scope ? (JSON.parse(r.scope) as { to?: string[] }) : null;
    if (scope?.to?.length && !scope.to.some((t) => t.toLowerCase() === String(to ?? "").toLowerCase())) return { decision: person };
    return { decision: "allow", sessionRule: r.id };
  }
  return { decision: RANK[r.decision] > RANK[person] ? r.decision : person };
}

// ---------- Slack plumbing ----------

async function slack<T = any>(env: Env, token: string, method: string, params: Record<string, string>): Promise<T & { ok: boolean; error?: string }> {
  const res = await fetch(`${slackApi(env)}/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return (await res.json()) as T & { ok: boolean; error?: string };
}

interface SlackConn {
  id: string;
  externalId: string;
  label: string;
  user: string; // decrypted user token
  bot: string | null; // decrypted bot token
}

async function slackConnection(env: Env, userId: string): Promise<SlackConn | null> {
  const row = await env.DB.prepare(`select * from "connection" where "userId" = ?1 and "provider" = 'slack'`)
    .bind(userId)
    .first<{ id: string; externalId: string; label: string; accessToken: string; botToken: string | null }>();
  if (!row) return null;
  return {
    id: row.id,
    externalId: row.externalId,
    label: row.label,
    user: await decryptToken(env.BETTER_AUTH_SECRET, row.accessToken),
    bot: row.botToken ? await decryptToken(env.BETTER_AUTH_SECRET, row.botToken) : null,
  };
}

// "#channel" or a teammate's email → a Slack conversation id, using the person's own token (their own visibility).
async function slackTarget(env: Env, token: string, to: string): Promise<string> {
  if (to.startsWith("#")) {
    const name = to.slice(1).toLowerCase();
    let cursor = "";
    for (let page = 0; page < 10; page++) {
      const r = await slack<{ channels: { id: string; name: string }[]; response_metadata?: { next_cursor?: string } }>(env, token, "conversations.list", {
        types: "public_channel,private_channel",
        exclude_archived: "true",
        limit: "1000",
        ...(cursor ? { cursor } : {}),
      });
      if (!r.ok) throw new Error(`Slack: ${r.error}`);
      const hit = r.channels.find((ch) => ch.name.toLowerCase() === name);
      if (hit) return hit.id;
      cursor = r.response_metadata?.next_cursor ?? "";
      if (!cursor) break;
    }
    throw new Error(`No Slack channel ${to} that you can see.`);
  }
  if (to.includes("@")) {
    const u = await slack<{ user: { id: string } }>(env, token, "users.lookupByEmail", { email: to });
    if (!u.ok) throw new Error(u.error === "users_not_found" ? `No one in your Slack workspace has the email ${to}.` : `Slack: ${u.error}`);
    const im = await slack<{ channel: { id: string } }>(env, token, "conversations.open", { users: u.user.id });
    if (!im.ok) throw new Error(`Slack: ${im.error}`);
    return im.channel.id;
  }
  throw new Error('Slack "to" must be "#channel" or a teammate\'s email.');
}

// ---------- executing actions ----------

const slackPayload = z.object({ to: z.string().min(2).max(200), text: z.string().min(1).max(4000) });
const textPayload = z.object({ to: z.string().min(3).max(200), text: z.string().min(1).max(1600) });
const emailPayload = z.object({ to: z.string().email(), subject: z.string().min(1).max(200), body: z.string().min(1).max(20_000) });

async function execute(env: Env, user: User, row: ActionRow): Promise<{ ok: boolean; detail: string; [k: string]: unknown }> {
  const p = JSON.parse(row.payload);
  if (row.action === "slack.post") {
    const conn = await slackConnection(env, user.id);
    if (!conn) return { ok: false, detail: "Slack isn't connected. Connect it at anydock.ai/app → Permissions." };
    try {
      const channel = await slackTarget(env, conn.user, p.to);
      const r = await slack<{ ts: string; channel: string }>(env, conn.user, "chat.postMessage", { channel, text: p.text });
      if (!r.ok) return { ok: false, detail: `Slack: ${r.error}` };
      return { ok: true, detail: `Posted to ${p.to} as you in ${conn.label}.`, channel: r.channel, ts: r.ts };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }
  if (row.action === "email.internal" || row.action === "email.external") {
    // Their own Gmail / Outlook when connected; AnyDock's sender otherwise.
    const own = await sendAsUser(env, user, { to: p.to, subject: p.subject, body: p.body });
    if (own) return own;
    return { ok: false, detail: "Connect Gmail or Outlook to send email as yourself. AnyDock system mail cannot be used for agent actions." };
  }
  if (row.action === "phone.text") {
    const phone = E164.test(p.to) ? p.to : p.to.includes("@") ? await phoneForEmail(env.DB, p.to) : null;
    if (!phone) return { ok: false, detail: `No phone number for ${p.to}. Use +1… format, or ask them to add their phone in AnyDock.` };
    return sendText(env, phone, `${p.text}\n— ${user.name || user.email} (via AnyDock)`);
  }
  if (row.action === "app.grant") {
    const ts = now();
    const expires = new Date(Date.now() + (p.days ?? 7) * 86_400_000).toISOString();
    await env.DB.batch((p.actions as Grantable[]).map((a) =>
      env.DB.prepare(`insert into "appGrant" ("id","artifactId","userId","grantorSessionId","action","scope","requestId","expiresAt","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8,?9)`)
        .bind(crypto.randomUUID(), p.artifactId, user.id, p.grantorSessionId ?? null, a, p.to?.length ? JSON.stringify({ to: p.to }) : null, row.id, expires, ts)));
    return { ok: true, detail: `App "${p.title}" can now ${(p.actions as Grantable[]).map((a) => ACTIONS[a].label.toLowerCase()).join(", ")} until ${expires.slice(0, 10)}.` };
  }
  if (row.action === "artifact.delete") {
    const a = await env.DB.prepare(`select "id","ownerId" from "artifact" where "id" = ?1`).bind(p.artifactId).first<{ id: string; ownerId: string }>();
    if (!a) return { ok: true, detail: `“${p.title}” was already deleted.` };
    if (a.ownerId !== user.id) return { ok: false, detail: "Only the owner can delete it." };
    const { deleteArtifact } = await import("./artifacts.ts");
    await deleteArtifact(env, a.id);
    return { ok: true, detail: `Deleted “${p.title}” for everyone.` };
  }
  return { ok: false, detail: `${row.action} isn't available yet.` };
}

async function load(db: D1Database, id: string, userId: string): Promise<ActionRow | null> {
  return db.prepare(`select * from "actionRequest" where "id" = ?1 and "userId" = ?2`).bind(id, userId).first<ActionRow>();
}

async function userById(db: D1Database, id: string): Promise<User | null> {
  return db.prepare(`select * from "user" where "id" = ?1`).bind(id).first<User>();
}

// Run an action that is allowed (by rule or by an approval) and record the outcome.
export async function run(env: Env, user: User, row: ActionRow): Promise<ActionRow> {
  const result = await execute(env, user, row);
  const prev = row.result ? JSON.parse(row.result) : {};
  const updated = await env.DB.prepare(
    `update "actionRequest" set "status" = ?2, "result" = ?3, "executedAt" = ?4 where "id" = ?1 returning *`,
  )
    .bind(row.id, result.ok ? "executed" : "failed", JSON.stringify({ ...prev, ...result }), now())
    .first<ActionRow>();
  await publish(env, [user.id], { type: "action.updated", action: actionJson(updated!) });
  return updated!;
}

// Approve or deny a pending request, from any channel. Idempotent: only the first decision counts.
export async function decide(env: Env, userId: string, id: string, approve: boolean, via: string, scope: "once" | "session" = "once"): Promise<ActionRow | null> {
  const db = env.DB;
  const claimed = await db
    .prepare(`update "actionRequest" set "status" = ?3, "decidedVia" = ?4, "decidedAt" = ?5 where "id" = ?1 and "userId" = ?2 and "status" = 'pending' returning *`)
    .bind(id, userId, approve ? "approved" : "denied", scope === "session" && approve ? `${via} · this session` : via, now())
    .first<ActionRow>();
  if (!claimed) return load(db, id, userId);
  // "Approve for this session": the same action from the same agent session runs without asking, for a while.
  if (approve && scope === "session" && claimed.source && claimed.sessionId && !ALWAYS_ASK.has(claimed.action)) {
    await db.prepare(`insert into "sessionRule" ("id","userId","cliSessionId","source","sessionId","action","decision","scope","createdVia","requestId","expiresAt","createdAt") values (?1,?2,?3,?4,?5,?6,'allow',null,?7,?8,?9,?10)`)
      .bind(crypto.randomUUID(), userId, claimed.cliSessionId, claimed.source, claimed.sessionId, claimed.action, via, claimed.id, new Date(Date.now() + SESSION_HOURS * 3_600_000).toISOString(), now()).run();
  }
  const user = await userById(db, userId);
  const final = approve && user ? await run(env, user, claimed) : claimed;
  if (!approve) await publish(env, [userId], { type: "action.updated", action: actionJson(final) });
  await updateSlackApproval(env, userId, final).catch(() => {});
  return final;
}

// ---------- approval notifications ----------

const ICON = { allow: "✅", ask: "🟡", deny: "⛔" } as const;

async function notifyApproval(env: Env, user: User, row: ActionRow, origin: string): Promise<void> {
  await publish(env, [user.id], { type: "action.new", action: actionJson(row) });
  const conn = await slackConnection(env, user.id).catch(() => null);
  if (!conn?.bot) return;
  const slackUserId = conn.externalId.split(":")[1];
  if (!slackUserId) return;
  const im = await slack<{ channel: { id: string } }>(env, conn.bot, "conversations.open", { users: slackUserId });
  if (!im.ok) return;
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `${ICON.ask} *Your agent wants to:* ${row.summary}\n_${row.agent ?? "agent"} · rule: ask me_` } },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Approve" }, action_id: "approve", value: row.id },
        ...(row.sessionId && !ALWAYS_ASK.has(row.action) ? [{ type: "button", text: { type: "plain_text", text: "Allow for this session" }, action_id: "approve_session", value: row.id }] : []),
        { type: "button", style: "danger", text: { type: "plain_text", text: "Deny" }, action_id: "deny", value: row.id },
        { type: "button", text: { type: "plain_text", text: "Open in AnyDock" }, url: `${origin}/app#/permissions` },
      ],
    },
  ];
  const msg = await slack<{ ts: string; channel: string }>(env, conn.bot, "chat.postMessage", {
    channel: im.channel.id,
    text: `Your agent wants to: ${row.summary}`,
    blocks: JSON.stringify(blocks),
  });
  if (msg.ok) {
    await env.DB.prepare(`update "actionRequest" set "result" = ?2 where "id" = ?1`)
      .bind(row.id, JSON.stringify({ approvalMsg: { channel: msg.channel, ts: msg.ts } }))
      .run();
  }
}

// When a request is decided anywhere, turn its Slack approval message into a plain receipt.
async function updateSlackApproval(env: Env, userId: string, row: ActionRow): Promise<void> {
  const res = row.result ? JSON.parse(row.result) : {};
  if (!res.approvalMsg) return;
  const conn = await slackConnection(env, userId);
  if (!conn?.bot) return;
  const outcome =
    row.status === "executed" ? `✅ Approved via ${row.decidedVia} — done.` : row.status === "failed" ? `⚠️ Approved, but it failed: ${res.detail}` : `⛔ Denied via ${row.decidedVia}.`;
  await slack(env, conn.bot, "chat.update", {
    channel: res.approvalMsg.channel,
    ts: res.approvalMsg.ts,
    text: `${row.summary} — ${outcome}`,
    blocks: JSON.stringify([{ type: "section", text: { type: "mrkdwn", text: `*${row.summary}*\n${outcome}` } }]),
  });
}

// ---------- API: rules ----------

delegate.get("/delegate", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const { results } = await c.env.DB.prepare(`select "action", "decision" from "policy" where "userId" = ?1`).bind(user.id).all<{ action: ActionKey; decision: Decision }>();
  const set = new Map(results.map((r) => [r.action, r.decision]));
  const conn = await c.env.DB.prepare(`select "label", "createdAt" from "connection" where "userId" = ?1 and "provider" = 'slack'`)
    .bind(user.id)
    .first<{ label: string; createdAt: string }>();
  return c.json({
    actions: (Object.keys(ACTIONS) as ActionKey[]).map((k) => ({ key: k, ...ACTIONS[k], decision: set.get(k) ?? ACTIONS[k].def })),
    connections: {
      slack: { available: slackReady(c.env), connected: Boolean(conn), label: conn?.label ?? null, since: conn?.createdAt ?? null },
      email: { available: Boolean(c.env.EMAIL), from: c.env.SYSTEM_EMAIL_FROM ?? (c.env.EMAIL ? "login@anydock.ai" : null) },
      ...(await mailboxStatus(c.env, user.id)),
      texting: { available: textingReady(c.env) },
    },
  });
});

delegate.put("/delegate/policy", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const parsed = z
    .object({ action: z.enum(Object.keys(ACTIONS) as [ActionKey, ...ActionKey[]]), decision: z.enum(["allow", "ask", "deny"]) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  if (ALWAYS_ASK.has(parsed.data.action) && parsed.data.decision === "allow") {
    return c.json({ error: "invalid_body", message: `"${ACTIONS[parsed.data.action].label}" always needs your OK — choose Ask me or Deny.` }, 400);
  }
  await c.env.DB.prepare(
    `insert into "policy" ("userId","action","decision","updatedAt") values (?1,?2,?3,?4)
     on conflict ("userId","action") do update set "decision" = excluded."decision", "updatedAt" = excluded."updatedAt"`,
  )
    .bind(user.id, parsed.data.action, parsed.data.decision, now())
    .run();
  return c.json({ ok: true, ...parsed.data });
});

// ---------- API: actions (agent asks; person decides) ----------

const sessionRef = z.object({ source: z.enum(["claude-code", "codex"]), sessionId: z.string().min(1).max(200) });
const askBody = z.object({
  action: z.enum(["slack.post", "email", "text", "app.grant", "artifact.delete"]),
  payload: z.record(z.string(), z.unknown()),
  agent: z.string().max(80).optional(),
  session: sessionRef.optional(), // which agent session is asking (the MCP / CLI fills it in)
});
const grantPayload = z.object({
  artifactId: z.string().min(1).max(100),
  actions: z.array(z.enum(GRANTABLE)).min(1).max(GRANTABLE.length),
  days: z.number().int().min(1).max(30).default(7),
  to: z.array(z.string().min(2).max(200)).max(20).optional(), // only these recipients / channels
});
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// Turn a request into a concrete action with a human summary (also used for app calls).
export async function classify(env: Env, user: User, name: string, raw: unknown, grantorSessionId: string | null):
  Promise<{ action: ActionKey; payload: Record<string, unknown>; summary: string } | { error: string; message?: string }> {
  if (name === "slack.post") {
    const p = slackPayload.safeParse(raw);
    if (!p.success) return { error: "invalid_payload", message: p.error.issues[0]?.message };
    return { action: "slack.post", payload: p.data, summary: `Post in Slack to ${p.data.to}: “${clip(p.data.text, 120)}”` };
  }
  if (name === "text") {
    const p = textPayload.safeParse(raw);
    if (!p.success) return { error: "invalid_payload", message: p.error.issues[0]?.message };
    return { action: "phone.text", payload: p.data, summary: `Text ${p.data.to}: “${clip(p.data.text, 100)}”` };
  }
  if (name === "email") {
    const p = emailPayload.safeParse(raw);
    if (!p.success) return { error: "invalid_payload", message: p.error.issues[0]?.message };
    const domain = (s: string) => s.split("@")[1]!.toLowerCase();
    const mine = domain(user.email);
    return { action: !PUBLIC_DOMAINS.has(mine) && domain(p.data.to) === mine ? "email.internal" : "email.external", payload: p.data, summary: `Email ${p.data.to}: “${p.data.subject}”` };
  }
  if (name === "app.grant") {
    const p = grantPayload.safeParse(raw);
    if (!p.success) return { error: "invalid_payload", message: p.error.issues[0]?.message };
    const art = await env.DB.prepare(`select "id","title","kind","ownerId" from "artifact" where "id" = ?1`).bind(p.data.artifactId).first<{ id: string; title: string; kind: string; ownerId: string }>();
    if (!art || (art.kind !== "app" && art.kind !== "html")) return { error: "not_found", message: "No such app." };
    const { artifactAccess } = await import("./artifacts.ts");
    const access = await artifactAccess(env.DB, (await env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(art.id).first())!, user.id);
    if (access !== "owner" && access !== "edit") return { error: "forbidden", message: "You can only give permissions to apps you can edit." };
    // Narrowing: an app only gets what its grantor holds right now.
    for (const a of p.data.actions) {
      if ((await decisionFor(env.DB, user.id, a)) === "deny") return { error: "not_yours", message: `Your rules don't allow "${ACTIONS[a].label}", so it can't be given to an app.` };
    }
    const what = p.data.actions.map((a) => ACTIONS[a].label.toLowerCase()).join(", ");
    return {
      action: "app.grant",
      payload: { ...p.data, title: art.title, grantorSessionId },
      summary: `Let app “${art.title}” ${what}${p.data.to?.length ? ` (only ${p.data.to.join(", ")})` : ""} for ${p.data.days} day${p.data.days === 1 ? "" : "s"}`,
    };
  }
  if (name === "artifact.delete") {
    const p = z.object({ artifactId: z.string().min(1).max(100) }).safeParse(raw);
    if (!p.success) return { error: "invalid_payload", message: p.error.issues[0]?.message };
    const art = await env.DB.prepare(`select * from "artifact" where "id" = ?1`).bind(p.data.artifactId).first<{ id: string; title: string; kind: string; ownerId: string }>();
    if (!art) return { error: "not_found", message: "No such artifact." };
    // Not yours: refused outright, nobody is asked.
    if (art.ownerId !== user.id) {
      const { artifactAccess } = await import("./artifacts.ts");
      if (!(await artifactAccess(env.DB, art as any, user.id))) return { error: "not_found", message: "No such artifact." };
      return { error: "forbidden", message: `Only the owner can delete “${art.title}”.` };
    }
    return { action: "artifact.delete", payload: { artifactId: art.id, title: art.title }, summary: `Delete ${art.kind} “${art.title}” for everyone (its history and files too)` };
  }
  return { error: "invalid_action" };
}

// Record a request and apply the person's rule: allow → run now, ask → wait for them, deny → blocked.
// `forceAllow` is for the person granting from their own browser (they are the approver).
export async function requestAction(env: Env, origin: string, user: User,
  req: { action: ActionKey; payload: Record<string, unknown>; summary: string; agent: string | null; forceAllow?: boolean; session?: AgentSessionRef | null; cliSessionId?: string | null },
  wait: (p: Promise<unknown>) => void): Promise<{ row: ActionRow; code: 200 | 202 | 403 }> {
  const eff = req.forceAllow ? { decision: "allow" as Decision } : await effectiveDecision(env.DB, user.id, req.action, req.session ?? null, req.cliSessionId ?? null, req.payload.to);
  const decision = eff.decision;
  const status = decision === "allow" ? "approved" : decision === "ask" ? "pending" : "blocked";
  const via = req.forceAllow ? "dashboard" : decision === "ask" ? null : eff.sessionRule ? "session rule" : "rule";
  const row = (await env.DB.prepare(
    `insert into "actionRequest" ("id","userId","agent","action","payload","summary","status","decision","decidedVia","createdAt","decidedAt","source","sessionId","cliSessionId")
     values (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14) returning *`,
  )
    .bind(crypto.randomUUID(), user.id, req.agent, req.action, JSON.stringify(req.payload), req.summary, status, decision, via, now(), decision === "ask" ? null : now(),
      req.session?.source ?? null, req.session?.sessionId ?? null, req.cliSessionId ?? null)
    .first<ActionRow>())!;
  if (decision === "allow") return { row: await run(env, user, row), code: 200 };
  if (decision === "deny") {
    await publish(env, [user.id], { type: "action.updated", action: actionJson(row) });
    return { row, code: 403 };
  }
  wait(notifyApproval(env, user, row, origin).catch((e) => console.error("approval notify failed", e)));
  return { row, code: 202 };
}

delegate.post("/actions", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const parsed = askBody.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", issues: parsed.error.issues }, 400);
  const agentSession = isAgent(c) ? c.get("session")!.session.id : null;
  const cl = await classify(c.env, user, parsed.data.action, parsed.data.payload, agentSession);
  if ("error" in cl) return c.json(cl, cl.error === "forbidden" || cl.error === "not_yours" ? 403 : cl.error === "not_found" ? 404 : 400);
  const origin = new URL(c.req.url).origin;
  const { row, code } = await requestAction(c.env, origin, user,
    { ...cl, agent: parsed.data.agent ?? null, forceAllow: cl.action === "app.grant" && !agentSession, session: agentSession ? parsed.data.session ?? null : null, cliSessionId: agentSession },
    (p) => c.executionCtx.waitUntil(p));
  if (code === 202) return c.json({ action: { ...actionJson(row), approveUrl: `${origin}/app#/inbox` } }, 202);
  return c.json({ action: actionJson(row) }, code);
});

delegate.get("/actions", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const status = c.req.query("status");
  const { results } = await c.env.DB.prepare(
    `select * from "actionRequest" where "userId" = ?1 ${status ? `and "status" = ?2` : ""} order by "createdAt" desc limit 100`,
  )
    .bind(...(status ? [user.id, status] : [user.id]))
    .all<ActionRow>();
  return c.json({ actions: results.map(actionJson) });
});

delegate.get("/actions/:id", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const row = await load(c.env.DB, c.req.param("id"), user.id);
  return row ? c.json({ action: actionJson(row) }) : c.json({ error: "not_found" }, 404);
});

delegate.post("/actions/:id/decide", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const parsed = z.object({ approve: z.boolean(), via: z.enum(["dashboard", "agent", "mac"]).optional(), signature: z.string().max(200).optional(), scope: z.enum(["once", "session"]).default("once") })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const { approve, signature, scope } = parsed.data;
  let via: string;
  if (!isAgent(c)) {
    via = "dashboard"; // a person signed in to the web app
  } else if (!approve) {
    via = parsed.data.via === "mac" ? "mac" : "agent"; // anyone may say no
  } else {
    // An agent's token can only approve with this device's signature, which needs Touch ID or the Mac password.
    const row = await load(c.env.DB, c.req.param("id"), user.id);
    if (!row) return c.json({ error: "not_found" }, 404);
    const sessionId = c.get("session")!.session.id;
    const check = signature ? await verifyDeviceApproval(c.env, sessionId, row, signature, scope) : { ok: false };
    if (!check.ok) {
      return c.json({ error: "human_required", message: "Approving needs the person: Touch ID or password on their Mac, the AnyDock dashboard, or Slack." }, 403);
    }
    via = "mac";
  }
  const row = await decide(c.env, user.id, c.req.param("id"), approve, via, scope);
  return row ? c.json({ action: actionJson(row) }) : c.json({ error: "not_found" }, 404);
});

// ---------- per agent session permissions ----------

// Agent sessions the person has seen lately, each with its own rules on top of the person's.
delegate.get("/sessions", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { results: seen } = await c.env.DB.prepare(
    `select "source","sessionId", max("createdAt") as "lastAt", count(*) as "requests", max("agent") as "agent", max("cliSessionId") as "cliSessionId"
     from "actionRequest" where "userId" = ?1 and "sessionId" is not null and "createdAt" > ?2 group by "source","sessionId"
     union select "source","sessionId", max("createdAt"), 0, null, max("cliSessionId") from "sessionRule" where "userId" = ?1 and "revokedAt" is null and "expiresAt" > ?3 group by "source","sessionId"
     order by 3 desc limit 50`,
  ).bind(user.id, since, now()).all<{ source: string; sessionId: string; lastAt: string; requests: number; agent: string | null; cliSessionId: string | null }>();
  const map = new Map<string, any>();
  for (const s of seen) {
    const k = `${s.source}|${s.sessionId}`;
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, requests: prev.requests + s.requests, lastAt: prev.lastAt > s.lastAt ? prev.lastAt : s.lastAt } : { ...s });
  }
  const sessions = [];
  for (const s of map.values()) {
    const [work, rules, device] = await Promise.all([
      c.env.DB.prepare(`select "id","title" from "work" where "ownerId" = ?1 and "source" = ?2 and "sessionId" = ?3`).bind(user.id, s.source, s.sessionId).first<{ id: string; title: string }>(),
      c.env.DB.prepare(`select "id","action","decision","scope","createdVia","expiresAt" from "sessionRule" where "userId" = ?1 and "source" = ?2 and "sessionId" = ?3 and "revokedAt" is null and "expiresAt" > ?4 order by "createdAt" desc`)
        .bind(user.id, s.source, s.sessionId, now()).all(),
      s.cliSessionId ? c.env.DB.prepare(`select "name" from "approvalKey" where "sessionId" = ?1`).bind(s.cliSessionId).first<{ name: string }>() : null,
    ]);
    sessions.push({ ...s, title: work?.title ?? null, workId: work?.id ?? null, device: device?.name ?? null, rules: rules.results.map((r: any) => ({ ...r, scope: r.scope ? JSON.parse(r.scope) : null, label: ACTIONS[r.action as ActionKey]?.label ?? r.action })) });
  }
  return c.json({ sessions, hours: SESSION_HOURS });
});

// What one agent session may do right now (agents use this to know before they ask).
delegate.get("/sessions/effective", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const p = sessionRef.safeParse({ source: c.req.query("source"), sessionId: c.req.query("sessionId") });
  const cli = isAgent(c) ? c.get("session")!.session.id : null;
  const out: Record<string, { label: string; decision: Decision; person: Decision; bySession: boolean }> = {};
  for (const [k, a] of Object.entries(ACTIONS) as [ActionKey, (typeof ACTIONS)[ActionKey]][]) {
    if (!a.live) continue;
    const person = await decisionFor(c.env.DB, user.id, k);
    const eff = await effectiveDecision(c.env.DB, user.id, k, p.success ? p.data : null, cli);
    out[k] = { label: a.label, decision: eff.decision, person, bySession: eff.decision !== person || Boolean(eff.sessionRule) };
  }
  return c.json({ actions: out });
});

// Set one session's rule for one action. Narrowing (ask / deny) is open to the session's own agent too; allowing — or
// going back to inheriting, which could widen — is the person's call.
delegate.put("/sessions/rule", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const p = sessionRef.extend({ action: z.enum(Object.keys(ACTIONS) as [ActionKey, ...ActionKey[]]), decision: z.enum(["allow", "ask", "deny"]).nullable(), hours: z.number().min(1).max(72).optional(), to: z.array(z.string().max(200)).max(20).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid_body", issues: p.error.issues }, 400);
  const d = p.data;
  if (isAgent(c) && (d.decision === "allow" || d.decision === null)) return c.json({ error: "human_required", message: "Only the person can allow more for a session." }, 403);
  if (ALWAYS_ASK.has(d.action) && d.decision === "allow") return c.json({ error: "invalid_body", message: `"${ACTIONS[d.action].label}" always needs your OK.` }, 400);
  const ts = now();
  await c.env.DB.prepare(`update "sessionRule" set "revokedAt" = ?5 where "userId" = ?1 and "source" = ?2 and "sessionId" = ?3 and "action" = ?4 and "revokedAt" is null`)
    .bind(user.id, d.source, d.sessionId, d.action, ts).run();
  if (d.decision) {
    await c.env.DB.prepare(`insert into "sessionRule" ("id","userId","cliSessionId","source","sessionId","action","decision","scope","createdVia","expiresAt","createdAt") values (?1,?2,null,?3,?4,?5,?6,?7,?8,?9,?10)`)
      .bind(crypto.randomUUID(), user.id, d.source, d.sessionId, d.action, d.decision, d.to?.length ? JSON.stringify({ to: d.to }) : null, isAgent(c) ? "agent" : "dashboard",
        new Date(Date.now() + (d.hours ?? SESSION_HOURS) * 3_600_000).toISOString(), ts).run();
  }
  return c.json({ ok: true });
});

// Back to the person's rules for a session (drops its allows and its restrictions).
delegate.delete("/sessions/rules", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const p = sessionRef.safeParse({ source: c.req.query("source"), sessionId: c.req.query("sessionId") });
  if (!p.success) return c.json({ error: "invalid_query" }, 400);
  await c.env.DB.prepare(`update "sessionRule" set "revokedAt" = ?4 where "userId" = ?1 and "source" = ?2 and "sessionId" = ?3 and "revokedAt" is null`).bind(user.id, p.data.source, p.data.sessionId, now()).run();
  return c.json({ ok: true });
});

// ---------- Slack connect (OAuth v2: bot for approval DMs + the person's user token) ----------

delegate.get("/connectors/slack/start", async (c) => {
  const user = signedIn(c);
  if (!user) return c.redirect("/login?next=/app%23/permissions");
  if (!slackReady(c.env)) return c.text("Slack isn't configured on this server yet.", 503);
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", c.env.SLACK_CLIENT_ID!);
  url.searchParams.set("scope", BOT_SCOPES);
  url.searchParams.set("user_scope", USER_SCOPES);
  url.searchParams.set("redirect_uri", new URL("/api/connectors/slack/callback", c.req.url).toString());
  url.searchParams.set("state", await signState(c.env.BETTER_AUTH_SECRET, { u: user.id }));
  return c.redirect(url.toString());
});

delegate.get("/connectors/slack/callback", async (c) => {
  const user = signedIn(c);
  if (!user) return c.redirect("/login?next=/app%23/permissions");
  const state = await readState<{ u: string }>(c.env.BETTER_AUTH_SECRET, c.req.query("state") ?? "");
  if (!state || state.u !== user.id) return c.text("This link expired. Connect Slack again from Permissions.", 400);
  const code = c.req.query("code");
  if (!code) return c.redirect("/app#/permissions?slack=cancelled");
  const res = await fetch(`${slackApi(c.env)}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.env.SLACK_CLIENT_ID!,
      client_secret: c.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: new URL("/api/connectors/slack/callback", c.req.url).toString(),
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id: string; name: string };
    authed_user?: { id: string; access_token?: string; scope?: string };
  };
  if (!data.ok || !data.authed_user?.access_token || !data.team) return c.text(`Slack said: ${data.error ?? "no user token granted"}`, 400);
  const secret = c.env.BETTER_AUTH_SECRET;
  const ts = now();
  await c.env.DB.prepare(
    `insert into "connection" ("id","userId","provider","externalId","label","accessToken","botToken","scopes","createdAt","updatedAt")
     values (?1,?2,'slack',?3,?4,?5,?6,?7,?8,?8)
     on conflict ("userId","provider") do update set "externalId" = excluded."externalId", "label" = excluded."label",
       "accessToken" = excluded."accessToken", "botToken" = excluded."botToken", "scopes" = excluded."scopes", "updatedAt" = excluded."updatedAt"`,
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      `${data.team.id}:${data.authed_user.id}`,
      data.team.name,
      await encryptToken(secret, data.authed_user.access_token),
      data.access_token ? await encryptToken(secret, data.access_token) : null,
      data.authed_user.scope ?? null,
      ts,
    )
    .run();
  return c.redirect("/app#/permissions?slack=connected");
});

delegate.delete("/connectors/slack", async (c) => {
  const user = signedIn(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  await c.env.DB.prepare(`delete from "connection" where "userId" = ?1 and "provider" = 'slack'`).bind(user.id).run();
  return c.json({ ok: true });
});

// Button clicks on approval DMs. Verified with Slack's signing secret; the clicker must be the request's owner.
delegate.post("/connectors/slack/interactions", async (c) => {
  if (!c.env.SLACK_SIGNING_SECRET) return c.text("not configured", 503);
  const body = await c.req.text();
  const ts = c.req.header("X-Slack-Request-Timestamp") ?? "";
  const sig = c.req.header("X-Slack-Signature") ?? "";
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return c.text("stale", 401);
  const expected = `v0=${await hmacHex(c.env.SLACK_SIGNING_SECRET, `v0:${ts}:${body}`)}`;
  if (!sameString(expected, sig)) return c.text("bad signature", 401);

  const payload = JSON.parse(new URLSearchParams(body).get("payload") ?? "{}") as {
    type: string;
    user?: { id: string; team_id?: string };
    team?: { id: string };
    actions?: { action_id: string; value?: string }[];
  };
  const act = payload.actions?.[0];
  if (payload.type !== "block_actions" || !act?.value || !["approve", "approve_session", "deny"].includes(act.action_id)) return c.body(null, 200);
  const externalId = `${payload.team?.id ?? payload.user?.team_id}:${payload.user?.id}`;
  // Start from the request: whose is it, and is the clicker that person's connected Slack account?
  const owner = await c.env.DB.prepare(
    `select r."userId" from "actionRequest" r join "connection" k on k."userId" = r."userId" and k."provider" = 'slack'
     where r."id" = ?1 and k."externalId" = ?2`,
  )
    .bind(act.value, externalId)
    .first<{ userId: string }>();
  if (!owner) return c.json({ response_type: "ephemeral", text: "This Slack account isn't connected to AnyDock." });
  c.executionCtx.waitUntil(decide(c.env, owner.userId, act.value, act.action_id === "approve" || act.action_id === "approve_session", "slack", act.action_id === "approve_session" ? "session" : "once").then(() => {}));
  return c.body(null, 200);
});
