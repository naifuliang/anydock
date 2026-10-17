import { statSync, watch } from "node:fs";
import { api, ApiError } from "./api.ts";
import { isAuthorized, loadConfig, loadState, type Config } from "./config.ts";
import { listSessionFiles, parseSession, ROOTS, sourceOf, uploadableSteps } from "./sources/discover.ts";
import type { ParsedSession } from "./sources/types.ts";

const CHUNK = 500;

export interface SyncResult {
  workId: string;
  sent: number;
  stepCount: number;
}

// Upload whatever the server doesn't have yet. The server's stepCount is the source of truth,
// so this is safe to call any number of times and after restarts.
export async function syncSession(s: ParsedSession, cfg: Config = loadConfig()): Promise<SyncResult> {
  const { work } = await api<{ work: { id: string; stepCount: number } }>(
    "PUT",
    "/api/works",
    {
      source: s.source,
      sessionId: s.sessionId,
      title: s.title,
      cwd: s.cwd,
      gitBranch: s.gitBranch,
      lastActivityAt: s.lastActivityAt,
    },
    cfg,
  );
  const steps = uploadableSteps(s);
  let have = work.stepCount;
  let sent = 0;
  while (have < steps.length) {
    const chunk = steps.slice(have, have + CHUNK);
    try {
      const r = await api<{ stepCount: number }>("PUT", `/api/works/${work.id}/steps`, { fromIndex: have, steps: chunk }, cfg);
      sent += chunk.length;
      have = r.stepCount;
    } catch (e) {
      // Server is behind what we thought (e.g. another device); continue from its count.
      if (e instanceof ApiError && e.status === 409) {
        have = (e.data as { stepCount: number }).stepCount;
        continue;
      }
      throw e;
    }
  }
  return { workId: work.id, sent, stepCount: have };
}

const short = (id: string) => id.slice(0, 8);
const stamp = () => new Date().toLocaleTimeString();

// Foreground watcher: keeps authorized sessions in sync as agents write to them, and prints live events.
export async function watchAndSync(): Promise<never> {
  const cfg = loadConfig();
  console.log(`AnyDock is watching your agent sessions (${cfg.server}). Ctrl-C to stop.`);
  for (const [source, root] of Object.entries(ROOTS)) console.log(`  ${source.padEnd(11)} ${root}`);

  const inflight = new Map<string, Promise<void>>();
  const again = new Set<string>();

  // Serialize per file; if more writes land mid-upload, run once more afterwards.
  const run = (path: string): void => {
    if (inflight.has(path)) {
      again.add(path);
      return;
    }
    const job = (async () => {
      try {
        const source = sourceOf(path);
        if (!source) return;
        const session = parseSession({ source, path, mtimeMs: statSync(path).mtimeMs });
        if (!isAuthorized(loadState(), session)) return; // re-read: rules can change while running
        const r = await syncSession(session, cfg);
        if (r.sent > 0) console.log(`[${stamp()}] ↑ ${session.source} ${short(session.sessionId)} "${session.title}" +${r.sent} steps (${r.stepCount} total)`);
      } catch (e) {
        console.error(`[${stamp()}] sync failed for ${path}: ${(e as Error).message}`);
      }
    })().finally(() => {
      inflight.delete(path);
      if (again.delete(path)) run(path);
    });
    inflight.set(path, job);
  };

  // Agents append in bursts; wait for a quiet moment before uploading.
  const timers = new Map<string, NodeJS.Timeout>();
  const schedule = (path: string): void => {
    clearTimeout(timers.get(path));
    timers.set(path, setTimeout(() => (timers.delete(path), run(path)), 1000));
  };

  for (const f of listSessionFiles()) {
    const s = parseSession(f);
    if (isAuthorized(loadState(), s)) run(f.path);
  }

  for (const root of Object.values(ROOTS)) {
    try {
      watch(root, { recursive: true }, (_event, name) => {
        if (name && name.toString().endsWith(".jsonl")) schedule(`${root}/${name}`);
      });
    } catch {
      // Agent not installed on this machine; nothing to watch.
    }
  }
  // fs.watch can miss events (sleep, network drives); sweep periodically as a backstop.
  setInterval(() => {
    for (const f of listSessionFiles().slice(0, 50)) if (Date.now() - f.mtimeMs < 10 * 60_000) schedule(f.path);
  }, 30_000);

  connectLive(cfg);
  return new Promise<never>(() => {});
}

// Live events from the server: someone shared or handed work to you, or a work you can see moved forward.
function connectLive(cfg: Config, attempt = 0): void {
  if (!cfg.token) return;
  const url = `${cfg.server.replace(/^http/, "ws")}/api/live?token=${encodeURIComponent(cfg.token)}`;
  const ws = new WebSocket(url);
  let ping: NodeJS.Timeout | undefined;
  ws.onopen = () => {
    attempt = 0;
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), 30_000);
  };
  ws.onmessage = (m) => {
    if (m.data === "pong") return;
    let ev: any;
    try {
      ev = JSON.parse(String(m.data));
    } catch {
      return;
    }
    if (ev.type === "inbox.new") {
      const i = ev.item;
      const verb = i.kind === "handover" ? "handed over" : "shared";
      console.log(`[${stamp()}] 📥 ${i.fromName || i.fromEmail} ${verb} "${i.workTitle}"${i.body ? `: ${i.body}` : ""}`);
    } else if (ev.type === "work.updated") {
      console.log(`[${stamp()}] ↻ work ${short(ev.workId)} now has ${ev.stepCount} steps`);
    }
  };
  ws.onclose = () => {
    clearInterval(ping);
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    setTimeout(() => connectLive(cfg, attempt + 1), delay);
  };
  ws.onerror = () => {}; // onclose follows and handles the retry
}
