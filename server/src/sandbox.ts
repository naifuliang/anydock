import type { Env } from "./types.ts";

// Where an app's backend code runs. Swappable: Blaxel today (hackathon sponsor); Cloudflare Containers or another
// provider can implement the same interface. AnyDock proxies every request to the backend itself, so the sandbox needs
// no public URL, and the backend reaches AnyDock only through the app's own capability URL (ANYDOCK_APP_URL) —
// the same grants as the app's page, never a user token.
export interface SandboxRuntime {
  name: string;
  start(env: Env, app: { name: string; files: { path: string; bytes: Uint8Array }[]; env: Record<string, string>; port: number }): Promise<{ id: string; url: string }>;
  alive(env: Env, id: string): Promise<boolean>;
  stop(env: Env, id: string): Promise<void>;
  // Send a request to the running backend (adds the provider's auth).
  request(env: Env, url: string, init: RequestInit): Promise<Response>;
}

export function sandboxRuntime(env: Env): SandboxRuntime | null {
  if (env.BLAXEL_API_KEY && env.BLAXEL_WORKSPACE) return blaxel;
  return null;
}

// ---------- Blaxel (https://docs.blaxel.ai, OpenAPI: controlplane + sandbox API) ----------
// Control plane: https://api.blaxel.ai/v0 with Authorization: Bearer <key> + X-Blaxel-Workspace.
// Each sandbox answers at metadata.url (…bl.run) with X-Blaxel-Authorization; /filesystem/{path}, /process,
// and /port/{n}/… reaches a port inside it, authenticated with the same key.
const API = (env: Env) => env.BLAXEL_API ?? "https://api.blaxel.ai/v0";
const cp = (env: Env) => ({ Authorization: `Bearer ${env.BLAXEL_API_KEY}`, "X-Blaxel-Workspace": env.BLAXEL_WORKSPACE!, "Content-Type": "application/json" });
const dp = (env: Env) => ({ "X-Blaxel-Authorization": `Bearer ${env.BLAXEL_API_KEY}` });
const DIR = "/app";

async function ok(r: Response, what: string): Promise<any> {
  if (!r.ok) throw new Error(`Blaxel ${what}: ${r.status} ${(await r.text().catch(() => "")).slice(0, 200)}`);
  return r.json().catch(() => ({}));
}

const blaxel: SandboxRuntime = {
  name: "blaxel",

  async start(env, app) {
    const created = await ok(await fetch(`${API(env)}/sandboxes?createIfNotExist=true`, {
      method: "POST",
      headers: cp(env),
      body: JSON.stringify({
        metadata: { name: app.name, labels: { "anydock-app": app.name } },
        spec: { runtime: { image: "blaxel/base-image:latest", memory: 2048, ports: [{ name: "http", target: app.port, protocol: "HTTP" }] } },
      }),
    }), "create sandbox");
    const base = String(created?.metadata?.url ?? "").replace(/\/$/, "");
    if (!base) throw new Error("Blaxel didn't return the sandbox URL.");
    // Wait until its API answers.
    for (let i = 0; i < 30; i++) {
      const r = await fetch(`${base}/filesystem/${encodeURIComponent("/")}`, { headers: dp(env) }).catch(() => null);
      if (r?.ok) break;
      await new Promise((res) => setTimeout(res, 1000));
    }
    for (const f of app.files) {
      const form = new FormData();
      form.append("file", new Blob([f.bytes as Uint8Array<ArrayBuffer>]), f.path.split("/").pop()!);
      await ok(await fetch(`${base}/filesystem/${encodeURIComponent(`${DIR}/${f.path}`)}`, { method: "PUT", headers: dp(env), body: form }), `write ${f.path}`);
    }
    const hasPkg = app.files.some((f) => f.path === "package.json");
    const entry = app.files.some((f) => f.path === "server.js") ? "node server.js" : app.files.some((f) => f.path === "server/index.js") ? "node server/index.js" : "npm start";
    if (hasPkg) {
      await ok(await fetch(`${base}/process`, { method: "POST", headers: { ...dp(env), "Content-Type": "application/json" }, body: JSON.stringify({ command: "npm install --omit=dev --no-audit --no-fund", workingDir: DIR, waitForCompletion: true, timeout: 180 }) }), "npm install");
    }
    await ok(await fetch(`${base}/process`, {
      method: "POST",
      headers: { ...dp(env), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "app", command: entry, workingDir: DIR, env: { ...app.env, PORT: String(app.port) }, waitForPorts: [app.port], restartOnFailure: true, maxRestarts: 3 }),
    }), "start backend");
    return { id: app.name, url: `${base}/port/${app.port}` };
  },

  async alive(env, id) {
    const r = await fetch(`${API(env)}/sandboxes/${encodeURIComponent(id)}`, { headers: cp(env) }).catch(() => null);
    if (!r?.ok) return false;
    const s = (await r.json().catch(() => ({}))) as { status?: string };
    return !["FAILED", "TERMINATED", "DELETING"].includes(String(s?.status ?? "").toUpperCase());
  },

  async stop(env, id) {
    await fetch(`${API(env)}/sandboxes/${encodeURIComponent(id)}`, { method: "DELETE", headers: cp(env) });
  },

  request(env, url, init) {
    const headers = new Headers(init.headers);
    headers.set("X-Blaxel-Authorization", `Bearer ${env.BLAXEL_API_KEY}`);
    return fetch(url, { ...init, headers });
  },
};
