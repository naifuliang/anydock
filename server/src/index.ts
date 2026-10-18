import { Hono } from "hono";
import { createAuth } from "./auth.ts";
import { appPage } from "./app.ts";
import { landingPage } from "./landing.ts";
import { devicePage, loginPage } from "./pages.ts";
import type { AppEnv, Env } from "./types.ts";
import { projects } from "./projects.ts";
import { works } from "./works.ts";

export { UserHub } from "./hub.ts";

const app = new Hono<AppEnv>();

// Bindings only exist per request on Workers, so Better Auth is built per request.
app.use("*", async (c, next) => {
  const auth = createAuth(c.env, c.env.DB);
  c.set("auth", auth);
  c.set("session", await auth.api.getSession({ headers: sessionHeaders(c.req.raw) }));
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => c.get("auth").handler(c.req.raw));

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/me", (c) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "unauthorized" }, 401);
  const { id, name, email, image } = session.user;
  return c.json({ user: { id, name, email, image } });
});

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
  return c.html(appPage(session.user, new URL(c.req.url).origin));
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
