import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "./types.ts";

// Texts through Inkbox (hackathon sponsor): iMessage from AnyDock's identity, falling back to SMS from its number.
// Used for delegate's "text a person" action and for handover alerts people opt into.
export const profile = new Hono<AppEnv>();

const api = (env: Env) => env.INKBOX_API ?? "https://inkbox.ai/api/v1";
export const textingReady = (env: Env) => Boolean(env.INKBOX_API_KEY && (env.INKBOX_IDENTITY_ID || env.INKBOX_PHONE_NUMBER_ID));
export const E164 = /^\+[1-9]\d{7,14}$/;

export async function sendText(env: Env, to: string, text: string): Promise<{ ok: boolean; detail: string; channel?: string }> {
  if (!textingReady(env)) return { ok: false, detail: "Texting isn't set up on AnyDock yet." };
  if (!E164.test(to)) return { ok: false, detail: `"${to}" isn't a phone number in international format (+1…).` };
  const headers = { "X-API-Key": env.INKBOX_API_KEY!, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), Prefer: "idempotency-replay" };
  let lastErr = "";
  if (env.INKBOX_IDENTITY_ID) {
    const r = await fetch(`${api(env)}/messages?agent_identity_id=${encodeURIComponent(env.INKBOX_IDENTITY_ID)}`, { method: "POST", headers, body: JSON.stringify({ to, text }) });
    if (r.ok) return { ok: true, detail: `Sent an iMessage to ${to}.`, channel: "imessage" };
    lastErr = `iMessage ${r.status}`;
  }
  if (env.INKBOX_PHONE_NUMBER_ID) {
    const r = await fetch(`${api(env)}/numbers/${encodeURIComponent(env.INKBOX_PHONE_NUMBER_ID)}/texts`, { method: "POST", headers: { ...headers, "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ to, text }) });
    if (r.ok) return { ok: true, detail: `Sent a text to ${to}.`, channel: "sms" };
    lastErr = `${lastErr ? lastErr + ", " : ""}SMS ${r.status}`;
  }
  return { ok: false, detail: `Inkbox couldn't deliver it (${lastErr}).` };
}

export async function profileOf(db: D1Database, userId: string) {
  return db.prepare(`select "phone", "textOnHandover" from "profile" where "userId" = ?1`).bind(userId).first<{ phone: string | null; textOnHandover: number }>();
}

// A teammate's phone by their AnyDock email (only if they saved one).
export async function phoneForEmail(db: D1Database, email: string): Promise<string | null> {
  const r = await db
    .prepare(`select p."phone" from "profile" p join "user" u on u."id" = p."userId" where lower(u."email") = ?1`)
    .bind(email.trim().toLowerCase())
    .first<{ phone: string | null }>();
  return r?.phone ?? null;
}

// Handover alert, if the recipient opted in. Best effort.
export async function textOnHandover(env: Env, toUserId: string, from: string, title: string, link: string): Promise<void> {
  const p = await profileOf(env.DB, toUserId);
  if (!p?.phone || !p.textOnHandover) return;
  await sendText(env, p.phone, `${from} handed you “${title}” on AnyDock. Pick it up: ${link}`).catch(() => {});
}

profile.get("/me/profile", async (c) => {
  const user = c.get("session")?.user;
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const p = await profileOf(c.env.DB, user.id);
  return c.json({ phone: p?.phone ?? null, textOnHandover: Boolean(p?.textOnHandover), textingReady: textingReady(c.env) });
});

profile.put("/me/profile", async (c) => {
  const user = c.get("session")?.user;
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const parsed = z
    .object({ phone: z.string().regex(E164, "Use international format, e.g. +14155550123").nullable(), textOnHandover: z.boolean() })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body", message: parsed.error.issues[0]?.message }, 400);
  await c.env.DB.prepare(
    `insert into "profile" ("userId","phone","textOnHandover","updatedAt") values (?1,?2,?3,?4)
     on conflict ("userId") do update set "phone" = excluded."phone", "textOnHandover" = excluded."textOnHandover", "updatedAt" = excluded."updatedAt"`,
  )
    .bind(user.id, parsed.data.phone, parsed.data.textOnHandover ? 1 : 0, new Date().toISOString())
    .run();
  return c.json({ ok: true, ...parsed.data });
});
