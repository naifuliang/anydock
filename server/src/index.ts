import { Hono } from "hono";
import { createAuth, type Auth, type AuthEnv } from "./auth.ts";
import { devicePage, homePage, loginPage } from "./pages.ts";

export interface Env extends AuthEnv {
  DB: D1Database;
  TRAJECTORIES: R2Bucket;
}

type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

type AppEnv = {
  Bindings: Env;
  Variables: { auth: Auth; session: Session | null };
};

const app = new Hono<AppEnv>();

// Bindings only exist per request on Workers, so Better Auth is built per request.
app.use("*", async (c, next) => {
  const auth = createAuth(c.env, c.env.DB);
  c.set("auth", auth);
  c.set("session", await auth.api.getSession({ headers: c.req.raw.headers }));
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

const providers = (env: Env) => ({
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
});

app.get("/", (c) => c.html(homePage(c.get("session")?.user ?? null)));

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

// Only same-site relative paths, so /login can't be used as an open redirect.
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default app;
