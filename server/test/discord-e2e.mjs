// End-to-end test of the Discord connector against local wrangler dev and a mock Discord API on :8799.
// Local dev must have (in server/.dev.vars): DISCORD_APPLICATION_ID=test-app, DISCORD_BOT_TOKEN=test-bot-token,
// DISCORD_API=http://localhost:8799, DISCORD_PUBLIC_KEY=<publicKeyHex from test/discord-test-key.json>.
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/discord-e2e.mjs dev.log
import { createServer } from "node:http";
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const KEY = createPrivateKey(JSON.parse(readFileSync(new URL("./discord-test-key.json", import.meta.url), "utf8")).privateKeyPem);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

// ---------- mock Discord ----------
const posted = []; let commands = null;
const mock = createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
  if (req.headers.authorization !== "Bot test-bot-token") return send(401, { message: "401: Unauthorized" });
  const u = req.url;
  if (req.method === "GET" && u === "/guilds/g1") return send(200, { id: "g1", name: "Hackathon HQ" });
  if (req.method === "GET" && u === "/guilds/g1/channels") return send(200, [
    { id: "c2", name: "random", type: 0, position: 2 }, { id: "c1", name: "general", type: 0, position: 1 }, { id: "v1", name: "Voice", type: 2, position: 0 }]);
  if (req.method === "GET" && u.startsWith("/guilds/")) return send(404, { message: "Unknown Guild" });
  if (req.method === "GET" && u === "/channels/c1") return send(200, { id: "c1", name: "general", guild_id: "g1" });
  if (req.method === "GET" && u === "/channels/x9") return send(200, { id: "x9", name: "elsewhere", guild_id: "g2" });
  if (req.method === "POST" && /^\/channels\/\w+\/messages$/.test(u)) { posted.push({ channel: u.split("/")[2], ...JSON.parse(body) }); return send(200, { id: "m" + posted.length }); }
  if (req.method === "PUT" && u === "/applications/test-app/commands") { commands = JSON.parse(body); return send(200, commands); }
  send(404, { message: "not mocked: " + req.method + " " + u });
});
await new Promise((r) => mock.listen(8799, r));

// ---------- helpers ----------
async function call(token, method, path, body, extra = {}) {
  const res = await fetch(BASE + path, { method, redirect: "manual",
    headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}), ...extra },
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined });
  return { status: res.status, location: res.headers.get("location"), data: await res.json().catch(() => null), headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`))).join("\n").match(/sign-in code is (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}
function interaction(payload, { badSig = false } = {}) {
  const body = JSON.stringify(payload); const ts = String(Math.floor(Date.now() / 1000));
  let sig = sign(null, Buffer.from(ts + body), KEY).toString("hex");
  if (badSig) sig = sig.replace(/^./, (c) => (c === "a" ? "b" : "a"));
  return call(null, "POST", "/api/discord/interactions", body, { "X-Signature-Ed25519": sig, "X-Signature-Timestamp": ts, "content-type": "application/json" });
}
const cmd = (channel, sub, options = []) => ({ type: 2, channel_id: channel, data: { name: "anydock", options: [{ type: 1, name: sub, options }] } });

// ---------- tests ----------
const run = Date.now();
const alice = await signIn(`alice+${run}@example.com`);
const bob = await signIn(`bob+${run}@example.com`);
const eve = await signIn(`eve+${run}@example.com`);

check("status says configured", (await call(null, "GET", "/api/discord/status")).data?.configured === true);
const proj = (await call(alice, "POST", "/api/projects", { name: "Hackathon" })).data.project;
await call(alice, "POST", `/api/projects/${proj.id}/members`, { email: `bob+${run}@example.com` });

const inst = await call(alice, "GET", `/api/discord/install?projectId=${proj.id}`);
const auth = inst.location ? new URL(inst.location) : null;
check("install redirects to Discord consent", inst.status === 302 && auth?.host === "discord.com" && auth.searchParams.get("scope") === "bot applications.commands" && auth.searchParams.get("redirect_uri") === `${BASE}/api/discord/callback`);
check("non-member can't start install", (await call(eve, "GET", `/api/discord/install?projectId=${proj.id}`)).status === 403);
const state = auth.searchParams.get("state");

check("tampered state is rejected", (await call(alice, "GET", `/api/discord/callback?state=${state}x&guild_id=g1`)).status === 400);
check("state is bound to the user", (await call(bob, "GET", `/api/discord/callback?state=${state}&guild_id=g1`)).status === 400);
check("guild the bot isn't in is rejected", (await call(alice, "GET", `/api/discord/callback?state=${state}&guild_id=g404`)).status === 400);
const cb = await call(alice, "GET", `/api/discord/callback?state=${state}&guild_id=g1&code=abc`);
check("callback returns to the project with the guild", cb.status === 302 && cb.location === `/app#/p/${proj.id}?guild=g1`);
await sleep(500);
check("slash commands registered on connect", commands?.[0]?.name === "anydock" && commands[0].options.map((o) => o.name).join() === "why,recent");

const ch = (await call(alice, "GET", `/api/projects/${proj.id}/discord/channels?guild=g1`)).data;
check("channel picker lists text channels in order", ch?.guild?.name === "Hackathon HQ" && ch.channels.map((c) => c.name).join() === "general,random");
check("channel from another guild is rejected", (await call(alice, "POST", `/api/projects/${proj.id}/discord`, { guildId: "g1", channelId: "x9" })).status === 400);
check("outsider can't link a channel", (await call(eve, "POST", `/api/projects/${proj.id}/discord`, { guildId: "g1", channelId: "c1" })).status === 404);
const link = await call(alice, "POST", `/api/projects/${proj.id}/discord`, { guildId: "g1", channelId: "c1" });
check("link channel", link.status === 201 && link.data.link.channelName === "general");
check("bot says hello in the channel", posted.some((m) => m.channel === "c1" && m.embeds?.[0]?.title === "AnyDock is connected"));
check("project shows the link", (await call(bob, "GET", `/api/projects/${proj.id}/discord`)).data?.links?.[0]?.channelId === "c1");

const work = (await call(alice, "PUT", "/api/works", { source: "claude-code", sessionId: `d-${run}`, title: "Pick our hackathon tracks" })).data.work;
await call(alice, "PUT", `/api/works/${work.id}/steps`, { fromIndex: 0, steps: [
  { role: "user", type: "text", text: "Pick which sponsor tracks we should target." },
  { role: "assistant", type: "tool_call", tool: "WebFetch", input: "{\"url\":\"https://events.ycombinator.com\"}" },
  { role: "tool", type: "tool_result", tool: "WebFetch", text: "Primitive: $3k cash. Blaxel: $1k." },
  { role: "assistant", type: "text", text: "Target Primitive's track: the most cash and it fits agent-to-human communication." },
  { role: "assistant", type: "text", text: "Skip Blaxel: smaller prize, weaker fit." } ] });
const before = posted.length;
await call(alice, "PUT", `/api/works/${work.id}/project`, { projectId: proj.id });
await sleep(500);
check("linking a work posts to Discord", posted.slice(before).some((m) => m.embeds?.[0]?.title === "Pick our hackathon tracks" && m.embeds[0].description.includes("added to the project")));
await call(alice, "POST", `/api/works/${work.id}/handover`, { to: `bob+${run}@example.com`, note: "Take it from here" });
await sleep(500);
const ho = posted.at(-1)?.embeds?.[0];
check("handover posts a card with the note", ho?.description.includes(`handed over to **bob+${run}@example.com**`) && ho.description.includes("Take it from here") && ho.url.endsWith(`/app#/w/${work.id}`));

check("unsigned interaction is rejected", (await call(null, "POST", "/api/discord/interactions", "{}", { "content-type": "application/json" })).status === 401);
check("bad signature is rejected", (await interaction({ type: 1 }, { badSig: true })).status === 401);
check("PING is answered", (await interaction({ type: 1 })).data?.type === 1);
const recent = (await interaction(cmd("c1", "recent"))).data;
check("/anydock recent lists project works", recent?.data?.embeds?.[0]?.description.includes("Pick our hackathon tracks"));
const why = (await interaction(cmd("c1", "why", [{ name: "question", type: 3, value: "why Primitive over Blaxel?" }]))).data;
const d = why?.data?.embeds?.[0]?.description ?? "";
check("/anydock why answers with cited steps", d.includes("**[3]** Target Primitive's track") && d.includes("**[4]**"), d.slice(0, 80));
const why2 = (await interaction(cmd("c1", "why", [{ name: "question", type: 3, value: "anything" }, { name: "work", type: 3, value: "no-such-work" }]))).data;
check("/anydock why with unknown work explains", why2?.data?.content.includes("No work") && why2.data.flags === 64);
const other = (await interaction(cmd("c999", "recent"))).data;
check("unconnected channel gets a private hint", other?.data?.flags === 64 && other.data.content.includes("isn't connected"));

const linkId = link.data.link.id;
check("disconnect", (await call(alice, "DELETE", `/api/projects/${proj.id}/discord/${linkId}`)).data?.ok && (await call(alice, "GET", `/api/projects/${proj.id}/discord`)).data.links.length === 0);

mock.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
