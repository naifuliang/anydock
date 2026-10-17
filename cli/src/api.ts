import { loadConfig, type Config } from "./config.ts";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(`HTTP ${status}: ${JSON.stringify(data)}`);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(method: string, path: string, body?: unknown, cfg: Config = loadConfig()): Promise<T> {
  const res = await fetch(cfg.server + path, {
    method,
    headers: {
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export function requireLogin(cfg: Config = loadConfig()): Config {
  if (!cfg.token) {
    console.error("Not signed in. Run: anydock login");
    process.exit(1);
  }
  return cfg;
}
