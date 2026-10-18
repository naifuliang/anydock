import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types.ts";

// Cloudflare Containers runtime for app backends: one AppContainer (Durable Object + container) per app, from the
// public Node image (no image build, no Docker needed to deploy). On boot, a tiny bootstrap downloads the app's files
// from a signed bundle URL, runs `npm install` if there is a package.json, and starts server.js / `npm start` on $PORT.
// It sleeps after IDLE_MS without requests and wakes on the next one.
const IDLE_MS = 10 * 60_000;
const PORT = 3000;

const BOOT = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
(async () => {
  const r = await fetch(process.env.ANYDOCK_BUNDLE_URL);
  if (!r.ok) throw new Error("bundle " + r.status);
  const { files } = await r.json();
  const dir = "/app";
  for (const f of files) {
    const p = path.join(dir, f.path);
    if (!p.startsWith(dir + "/")) continue;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(f.data, "base64"));
  }
  const has = (p) => fs.existsSync(path.join(dir, p));
  if (has("package.json")) cp.execSync("npm install --omit=dev --no-audit --no-fund", { cwd: dir, stdio: "inherit" });
  const cmd = has("server.js") ? ["node", "server.js"] : has("server/index.js") ? ["node", "server/index.js"] : ["npm", "start"];
  const env = { ...process.env };
  delete env.ANYDOCK_BUNDLE_URL;
  const child = cp.spawn(cmd[0], cmd.slice(1), { cwd: dir, stdio: "inherit", env });
  child.on("exit", (code) => process.exit(code ?? 1));
})().catch((e) => { console.error(e); process.exit(1); });
`;

type Cfg = { env: Record<string, string> };

export class AppContainer extends DurableObject<Env> {
  private boot(cfg: Cfg) {
    this.ctx.container!.start({ entrypoint: ["node", "-e", BOOT], enableInternet: true, env: cfg.env });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const c = this.ctx.container;
    if (!c) return new Response("Containers aren't available here.", { status: 503 });
    if (url.pathname === "/__start") {
      const cfg = (await req.json()) as Cfg;
      await this.ctx.storage.put("cfg", cfg);
      if (c.running) await c.destroy().catch(() => {});
      this.boot(cfg);
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
      return Response.json({ ok: true });
    }
    if (url.pathname === "/__alive") return Response.json({ alive: c.running || Boolean(await this.ctx.storage.get("cfg")) });
    if (url.pathname === "/__stop") {
      if (c.running) await c.destroy().catch(() => {});
      await this.ctx.storage.delete("cfg");
      return Response.json({ ok: true });
    }
    // A request for the app: wake it if it was sleeping, then forward once its port answers.
    if (!c.running) {
      const cfg = await this.ctx.storage.get<Cfg>("cfg");
      if (!cfg) return new Response("This backend isn't started.", { status: 503 });
      this.boot(cfg);
    }
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();
    const target = "http://container" + url.pathname.replace(/^\/__app/, "") + url.search;
    let last: unknown;
    for (let i = 0; i < 180; i++) {
      try {
        return await c.getTcpPort(PORT).fetch(new Request(target, { method: req.method, headers: req.headers, body }));
      } catch (e) {
        last = e;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return new Response(`The app's backend didn't start in time (${String(last).slice(0, 200)}).`, { status: 502 });
  }

  async alarm(): Promise<void> {
    if (this.ctx.container?.running) await this.ctx.container.destroy().catch(() => {});
  }
}
