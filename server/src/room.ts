import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types.ts";

// One room per artifact (idFromName(artifactId)): everyone who has it open — people in the browser, the Mac viewer —
// sees edits land live and who is where. The Worker checks access before forwarding a socket here.
type Person = { conn: string; userId: string; name: string; via: string; color: string; focus: string | null };

const COLORS = ["#2b59ff", "#e5484d", "#12a594", "#f76b15", "#8e4ec6", "#d6409f", "#0090ff", "#46a758"];

export class ArtifactRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      const userId = request.headers.get("x-user-id") ?? "";
      const person: Person = {
        conn: crypto.randomUUID(),
        userId,
        name: request.headers.get("x-user-name") ?? "Someone",
        via: request.headers.get("x-via") ?? "web",
        color: COLORS[[...userId].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]!,
        focus: null,
      };
      server.serializeAttachment(person);
      server.send(JSON.stringify({ type: "hello", you: person.conn }));
      this.presence();
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === "/broadcast" && request.method === "POST") {
      this.send(await request.text());
      return new Response(null, { status: 204 });
    }
    return new Response("not found", { status: 404 });
  }

  private send(payload: string) {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(payload); } catch {}
    }
  }

  private presence(leaving?: WebSocket) {
    const people = this.ctx.getWebSockets().filter((ws) => ws !== leaving).map((ws) => ws.deserializeAttachment() as Person).filter(Boolean);
    this.send(JSON.stringify({ type: "presence", people }));
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") return ws.send("pong");
    let m: { type?: string; focus?: string | null };
    try { m = JSON.parse(String(message)); } catch { return; }
    if (m.type === "focus") {
      const p = ws.deserializeAttachment() as Person;
      ws.serializeAttachment({ ...p, focus: typeof m.focus === "string" ? m.focus.slice(0, 80) : null });
      this.presence();
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    this.presence(ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, "closing"); } catch {}
  }
}

export async function roomBroadcast(env: Env, artifactId: string, event: Record<string, unknown>): Promise<void> {
  await env.ROOM.get(env.ROOM.idFromName(artifactId)).fetch("https://room/broadcast", { method: "POST", body: JSON.stringify(event) });
}
