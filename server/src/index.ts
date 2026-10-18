import { Hono } from "hono";
import { createAuth } from "./auth.ts";
import { appPage } from "./app.ts";
import { delegate } from "./delegate.ts";
import { discord, discordEnabled } from "./discord.ts";
import { landingPage } from "./landing.ts";
import { profile } from "./inkbox.ts";
import { mailbox } from "./mailbox.ts";
import { devicePage, loginPage } from "./pages.ts";
import type { AppEnv, Env } from "./types.ts";
import { projects } from "./projects.ts";
import { works } from "./works.ts";
import { organizations } from "./organizations.ts";
import { agentForbidden, isAgentSession, recordDeviceLogin } from "./trust.ts";

export { UserHub } from "./hub.ts";

const app = new Hono<AppEnv>();

// Bindings only exist per request on Workers, so Better Auth is built per request.
app.use("*", async (c, next) => {
  const auth = createAuth(c.env, c.env.DB);
  c.set("auth", auth);
  const session = await auth.api.getSession({ headers: sessionHeaders(c.req.raw) });
  c.set("session", session);
  // Agent (CLI) sessions are limited to agent powers; see trust.ts.
  const agent = session ? await isAgentSession(c.env.DB, session.session.id) : false;
  c.set("agent", agent);
  if (agent && agentForbidden(c.req.method, c.req.path)) {
    return c.json({ error: "human_required", message: "Only the person can do this, in the AnyDock dashboard — not an agent's token." }, 403);
  }
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  if (c.req.method === "POST" && c.req.path === "/api/auth/device/token") {
    const body = (await c.req.raw.clone().json().catch(() => ({}))) as Record<string, unknown>;
    const res = await c.get("auth").handler(c.req.raw);
    if (res.ok) {
      const data = (await res.clone().json().catch(() => ({}))) as { access_token?: string };
      if (data.access_token) await recordDeviceLogin(c.env, data.access_token, body);
    }
    return res;
  }
  return c.get("auth").handler(c.req.raw);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/me", async (c) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const { id, name, email, image } = session.user;
  const key = c.get("agent")
    ? await c.env.DB.prepare(`select "name" from "approvalKey" where "sessionId" = ?1`).bind(session.session.id).first<{ name: string }>()
    : null;
  return c.json({ user: { id, name, email, image }, agent: c.get("agent"), approvalKey: key ? { name: key.name } : null });
});

// Before projects/works: their middleware requires a session, but Discord calls /api/discord/* itself.
app.route("/api", discord);
app.route("/api", delegate);
app.route("/api", mailbox);
app.route("/api", profile);
app.route("/api", organizations);
app.route("/api", projects);
app.route("/api", works);

const providers = (env: Env) => ({
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
});

app.get("/", (c) => c.html(landingPage({ signedIn: Boolean(c.get("session")), origin: new URL(c.req.url).origin })));

app.get("/app", (c) => {
  const session = c.get("session");
  if (!session) return c.redirect("/login?next=/app");
  return c.html(appPage(session.user, new URL(c.req.url).origin, discordEnabled(c.env)));
});

app.get("/login", (c) => {
  const next = safeNext(c.req.query("next"));
  if (c.get("session")) return c.redirect(next);
  return c.html(loginPage({ next, providers: providers(c.env) }));
});

app.get("/device", (c) => {
  const userCode = c.req.query("user_code") ?? "";
  if (!c.get("session")) {
    const next = userCode ? `/device?user_code=${encodeURIComponent(userCode)}` : "/device";
    return c.redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return c.html(devicePage({ userCode, email: c.get("session")!.user.email }));
});

// WebSocket clients can't set headers, so /api/live also accepts the bearer token as ?token=.
function sessionHeaders(req: Request): Headers {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (url.pathname !== "/api/live" || !token || req.headers.has("Authorization")) return req.headers;
  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

// Only same-site relative paths, so /login can't be used as an open redirect.
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default app;
