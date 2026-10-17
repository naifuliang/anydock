import { DurableObject } from "cloudflare:workers";
import type { Env, LiveEvent } from "./types.ts";

// One instance per user (idFromName(userId)). Holds that user's open sockets — CLI, local app,
// browser — and fans out events. Uses WebSocket hibernation so idle connections cost nothing.
export class UserHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "hello" }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/publish" && request.method === "POST") {
      const payload = await request.text();
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(payload);
        } catch {
          // Socket already closing; hibernation API cleans it up.
        }
      }
      return new Response(null, { status: 204 });
    }

    return new Response("not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message === "ping") ws.send("pong");
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    ws.close(code, "closing");
  }
}

export async function publish(env: Env, userIds: Iterable<string>, event: LiveEvent): Promise<void> {
  const body = JSON.stringify(event);
  await Promise.all(
    [...new Set(userIds)].map((id) =>
      env.HUB.get(env.HUB.idFromName(id)).fetch("https://hub/publish", { method: "POST", body }),
    ),
  );
}
