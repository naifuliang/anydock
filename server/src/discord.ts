import { Hono, type Context } from "hono";
import { z } from "zod";
import { rankSteps, type Step } from "./rank.ts";
import type { AppEnv, Env, WorkRow } from "./types.ts";

// Discord connector. A project connects a channel: the bot posts there when the project's works are shared,
// handed over or linked, and answers /anydock slash commands in that channel from the project's works.
// Needs DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY and DISCORD_BOT_TOKEN (tasks/discord-setup.md).
export const discord = new Hono<AppEnv>();

const api = (env: Env) => env.DISCORD_API ?? "https://discord.com/api/v10";
export const discordEnabled = (env: Env) => Boolean(env.DISCORD_APPLICATION_ID && env.DISCORD_PUBLIC_KEY && env.DISCORD_BOT_TOKEN);
const now = () => new Date().toISOString();
const SEND_MESSAGES = 1n << 11n;
const EMBED_LINKS = 1n << 14n;
const VIEW_CHANNEL = 1n << 10n;

async function bot<T = any>(env: Env, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(api(env) + path, {
    method,
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Discord ${method} ${path} → ${res.status} ${await res.text()}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

// ---------- signed OAuth state (no table needed) ----------

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmac(env: Env, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.BETTER_AUTH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

async function signState(env: Env, payload: { p: string; u: string }): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, t: Date.now() })));
  return `${body}.${await hmac(env, body)}`;
}

async function readState(env: Env, state: string): Promise<{ p: string; u: string } | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig || (await hmac(env, body)) !== sig) return null;
  const data = JSON.parse(new TextDecoder().decode(unb64url(body))) as { p: string; u: string; t: number };
  return Date.now() - data.t < 15 * 60_000 ? data : null;
}

async function isMember(db: D1Database, projectId: string, userId: string) {
  return Boolean(await db.prepare(`select 1 from "projectMember" where "projectId" = ?1 and "userId" = ?2`).bind(projectId, userId).first());
}

function needSession(c: Context<AppEnv>) {
  const session = c.get("session");
  return session ? session.user : null;
}

// ---------- slash commands ----------

const COMMANDS = [
  {
    name: "anydock",
    description: "AnyDock: ask why, or see this project's recent work",
    type: 1,
    options: [
      {
        type: 1,
        name: "why",
        description: "Ask why something was done; answered from the trajectory, with cited steps",
        options: [
          { type: 3, name: "question", description: "e.g. why Primitive over Blaxel?", required: true },
          { type: 3, name: "work", description: "Work id prefix or title words (default: most recent work)", required: false },
        ],
      },
      { type: 1, name: "recent", description: "This project's most recent works" },
    ],
  },
];

// Global commands, bulk-overwritten (idempotent). Done on connect so no one has to run a script with the token.
async function registerCommands(env: Env): Promise<void> {
  await bot(env, "PUT", `/applications/${env.DISCORD_APPLICATION_ID}/commands`, COMMANDS);
}

// ---------- routes ----------

discord.get("/discord/status", (c) => c.json({ configured: discordEnabled(c.env), interactions: "/api/discord/interactions" }));

// Start: project page → Discord "add bot" consent → back to /api/discord/callback.
discord.get("/discord/install", async (c) => {
  const user = needSession(c);
  if (!user) return c.redirect(`/login?next=${encodeURIComponent(c.req.url)}`);
  if (!discordEnabled(c.env)) return c.text("Discord isn't configured on this server yet.", 503);
  const projectId = c.req.query("projectId") ?? "";
  if (!(await isMember(c.env.DB, projectId, user.id))) return c.text("Not a member of that project.", 403);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", c.env.DISCORD_APPLICATION_ID!);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", String(VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", new URL("/api/discord/callback", c.req.url).toString());
  url.searchParams.set("state", await signState(c.env, { p: projectId, u: user.id }));
  return c.redirect(url.toString());
});

// Discord sends the user back with guild_id. We don't trust it blindly: the bot must actually be in that guild.
discord.get("/discord/callback", async (c) => {
  const user = needSession(c);
  if (!user) return c.redirect("/login?next=/app");
  const state = await readState(c.env, c.req.query("state") ?? "");
  const guildId = c.req.query("guild_id");
  if (!state || state.u !== user.id) return c.text("This link expired. Start again from your project page.", 400);
  if (c.req.query("error") || !guildId) return c.redirect(`/app#/p/${state.p}`);
  try {
    await bot(c.env, "GET", `/guilds/${guildId}`);
    c.executionCtx.waitUntil(registerCommands(c.env).catch((e) => console.error("discord: register commands failed", e)));
  } catch {
    return c.text("The AnyDock bot isn't in that server. Try connecting again.", 400);
  }
  return c.redirect(`/app#/p/${state.p}?guild=${guildId}`);
});

discord.get("/projects/:id/discord", async (c) => {
  const user = needSession(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (!(await isMember(c.env.DB, c.req.param("id"), user.id))) return c.json({ error: "not_found" }, 404);
  const { results } = await c.env.DB.prepare(
    `select "id","guildId","guildName","channelId","channelName","createdAt" from "discordLink" where "projectId" = ?1 order by "createdAt"`,
  )
    .bind(c.req.param("id"))
    .all();
  return c.json({ configured: discordEnabled(c.env), links: results });
});

// Text channels the bot can see in a guild it was just added to.
discord.get("/projects/:id/discord/channels", async (c) => {
  const user = needSession(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (!(await isMember(c.env.DB, c.req.param("id"), user.id))) return c.json({ error: "not_found" }, 404);
  const guildId = c.req.query("guild") ?? "";
  try {
    const [guild, channels] = await Promise.all([
      bot<{ id: string; name: string }>(c.env, "GET", `/guilds/${guildId}`),
      bot<{ id: string; name: string; type: number; position: number }[]>(c.env, "GET", `/guilds/${guildId}/channels`),
    ]);
    const text = channels.filter((ch) => ch.type === 0 || ch.type === 5).sort((a, b) => a.position - b.position);
    return c.json({ guild: { id: guild.id, name: guild.name }, channels: text.map(({ id, name }) => ({ id, name })) });
  } catch {
    return c.json({ error: "bot_not_in_guild" }, 400);
  }
});

discord.post("/projects/:id/discord", async (c) => {
  const user = needSession(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const projectId = c.req.param("id");
  const db = c.env.DB;
  if (!(await isMember(db, projectId, user.id))) return c.json({ error: "not_found" }, 404);
  const parsed = z.object({ guildId: z.string().min(1), channelId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
  const { guildId, channelId } = parsed.data;
  let guild: { name: string }, channel: { name: string; guild_id: string };
  try {
    [guild, channel] = await Promise.all([bot(c.env, "GET", `/guilds/${guildId}`), bot(c.env, "GET", `/channels/${channelId}`)]);
  } catch {
    return c.json({ error: "bot_not_in_guild" }, 400);
  }
  if (channel.guild_id !== guildId) return c.json({ error: "channel_not_in_guild" }, 400);
  const project = await db.prepare(`select "name" from "project" where "id" = ?1`).bind(projectId).first<{ name: string }>();
  const id = crypto.randomUUID();
  await db
    .prepare(
      `insert into "discordLink" ("id","projectId","guildId","guildName","channelId","channelName","createdBy","createdAt") values (?1,?2,?3,?4,?5,?6,?7,?8)
       on conflict ("projectId","channelId") do update set "guildName" = excluded."guildName", "channelName" = excluded."channelName"`,
    )
    .bind(id, projectId, guildId, guild.name, channelId, channel.name, user.id, now())
    .run();
  const origin = new URL(c.req.url).origin;
  await bot(c.env, "POST", `/channels/${channelId}/messages`, {
    embeds: [{
      title: "AnyDock is connected",
      description: `This channel now follows **${project?.name ?? "the project"}**: shares and handovers show up here.\nTry \`/anydock recent\` or \`/anydock why <question>\`.`,
      url: `${origin}/app#/p/${projectId}`,
      color: 0x2b59ff,
    }],
  }).catch(() => {});
  return c.json({ link: { id, guildId, guildName: guild.name, channelId, channelName: channel.name } }, 201);
});

discord.delete("/projects/:id/discord/:linkId", async (c) => {
  const user = needSession(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  if (!(await isMember(c.env.DB, c.req.param("id"), user.id))) return c.json({ error: "not_found" }, 404);
  await c.env.DB.prepare(`delete from "discordLink" where "id" = ?1 and "projectId" = ?2`).bind(c.req.param("linkId"), c.req.param("id")).run();
  return c.json({ ok: true });
});

// ---------- interactions (slash commands) ----------

const hex = (s: string) => Uint8Array.from(s.match(/.{1,2}/g) ?? [], (b) => parseInt(b, 16));

async function verifyDiscord(env: Env, req: Request, body: string): Promise<boolean> {
  const sig = req.headers.get("X-Signature-Ed25519");
  const ts = req.headers.get("X-Signature-Timestamp");
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hex(env.DISCORD_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hex(sig), new TextEncoder().encode(ts + body));
  } catch {
    return false;
  }
}

const reply = (content: string, embeds?: unknown[], ephemeral = false) => ({
  type: 4,
  data: { content, ...(embeds ? { embeds } : {}), ...(ephemeral ? { flags: 64 } : {}), allowed_mentions: { parse: [] } },
});

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

discord.post("/discord/interactions", async (c) => {
  const body = await c.req.text();
  if (!(await verifyDiscord(c.env, c.req.raw, body))) return c.text("invalid request signature", 401);
  const ix = JSON.parse(body) as {
    type: number;
    channel_id?: string;
    data?: { name: string; options?: { name: string; options?: { name: string; value: string }[] }[] };
  };
  if (ix.type === 1) return c.json({ type: 1 }); // PING

  if (ix.type !== 2 || ix.data?.name !== "anydock") return c.json(reply("Unknown command.", undefined, true));
  const sub = ix.data.options?.[0];
  const opt = (n: string) => sub?.options?.find((o) => o.name === n)?.value;
  const db = c.env.DB;
  const origin = new URL(c.req.url).origin;

  const link = await db
    .prepare(`select l."projectId", p."name" from "discordLink" l join "project" p on p."id" = l."projectId" where l."channelId" = ?1 limit 1`)
    .bind(ix.channel_id ?? "")
    .first<{ projectId: string; name: string }>();
  if (!link) return c.json(reply("This channel isn't connected to an AnyDock project yet. Connect it from a project page at anydock.ai/app.", undefined, true));

  // Works visible to the channel = works linked to its project.
  const { results: works } = await db
    .prepare(
      `select w.*, u."name" as "ownerName", u."email" as "ownerEmail" from "work" w join "user" u on u."id" = w."ownerId"
       where w."projectId" = ?1 and w."visibility" = 'project' order by coalesce(w."lastActivityAt", w."updatedAt") desc limit 50`,
    )
    .bind(link.projectId)
    .all<WorkRow & { ownerName: string; ownerEmail: string }>();

  if (sub?.name === "recent") {
    if (works.length === 0) return c.json(reply(`No works in **${link.name}** yet. Link one from a work's page in AnyDock.`));
    const lines = works.slice(0, 8).map((w) => `• [${clip(w.title, 80)}](${origin}/app#/w/${w.id}) — ${w.ownerName || w.ownerEmail} · ${w.stepCount} steps`);
    return c.json(reply("", [{ title: `Recent work in ${link.name}`, description: lines.join("\n"), color: 0x2b59ff }]));
  }

  if (sub?.name === "why") {
    const question = opt("question") ?? "";
    const want = (opt("work") ?? "").toLowerCase().trim();
    const work = want ? works.find((w) => w.id.startsWith(want) || w.title.toLowerCase().includes(want)) : works[0];
    if (!work) return c.json(reply(want ? `No work in **${link.name}** matches "${want}".` : `No works in **${link.name}** yet.`, undefined, true));
    const obj = work.trajectoryKey ? await c.env.TRAJECTORIES.get(work.trajectoryKey) : null;
    const steps: Step[] = obj ? ((await obj.json()) as { steps: Step[] }).steps : [];
    const hits = rankSteps(steps, question, 4);
    const fmt = (i: number) => {
      const s = steps[i]!;
      const text = (s.type === "tool_call" ? `→ ${s.tool} ${s.input ?? ""}` : s.type === "tool_result" ? `← ${s.tool ?? "tool"} ${s.text ?? ""}` : s.text ?? "").replace(/\s+/g, " ");
      return `**[${i}]** ${clip(text, 300)}`;
    };
    const description = hits.length
      ? hits.map(fmt).join("\n\n")
      : `No step mentions that. [Read the trajectory](${origin}/app#/w/${work.id}) or ask ${work.ownerName || work.ownerEmail}.`;
    return c.json(
      reply(`> ${clip(question, 200)}`, [{
        title: clip(work.title, 200),
        url: `${origin}/app#/w/${work.id}`,
        description: clip(description, 3900),
        footer: { text: `${work.ownerName || work.ownerEmail}'s ${work.source === "codex" ? "Codex" : "Claude Code"} session · ${steps.length} steps · most relevant moments` },
        color: 0x2b59ff,
      }]),
    );
  }

  return c.json(reply("Try `/anydock why <question>` or `/anydock recent`.", undefined, true));
});

// ---------- notifications ----------

// Post to every channel connected to the work's project. Best effort: never fails the request that triggered it.
export async function notifyDiscord(
  env: Env,
  origin: string,
  work: Pick<WorkRow, "id" | "title" | "source" | "stepCount" | "projectId" | "visibility">,
  event: { kind: "share" | "handover" | "linked"; actor: string; to?: string; note?: string | null },
): Promise<void> {
  if (!discordEnabled(env) || !work.projectId) return;
  const { results } = await env.DB.prepare(`select "channelId" from "discordLink" where "projectId" = ?1`).bind(work.projectId).all<{ channelId: string }>();
  if (results.length === 0) return;
  const verb = event.kind === "handover" ? `handed over to **${event.to}**` : event.kind === "share" ? `shared with **${event.to}**` : "added to the project";
  const embed = {
    author: { name: `${event.actor} · ${work.source === "codex" ? "Codex" : "Claude Code"}` },
    title: clip(work.title, 200),
    url: `${origin}/app#/w/${work.id}`,
    description: `${event.kind === "handover" ? "🤝" : event.kind === "share" ? "📤" : "📌"} ${verb}${event.note ? `\n> ${clip(event.note, 300)}` : ""}`,
    fields: [{ name: "Steps", value: String(work.stepCount), inline: true }],
    footer: { text: "Ask about it here: /anydock why <question>" },
    color: event.kind === "handover" ? 0xf59e0b : 0x2b59ff,
  };
  await Promise.all(
    results.map((r) => bot(env, "POST", `/channels/${r.channelId}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } }).catch((e) => console.error("discord notify failed", e))),
  );
}
