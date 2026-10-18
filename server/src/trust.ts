import type { Context } from "hono";
import type { AppEnv, Env } from "./types.ts";

// Who is calling: a person in a browser, or an agent holding a CLI token.
// CLI tokens come only from the device flow, and every session it creates is recorded in "agentSession".
// Agent sessions can request actions and deny them; anything that grants power needs a person (see HUMAN_ONLY),
// and approving needs a signature from the device's approval key (Touch ID / password on that Mac).

const now = () => new Date().toISOString();

export async function isAgentSession(db: D1Database, sessionId: string | undefined): Promise<boolean> {
  if (!sessionId) return false;
  return Boolean(await db.prepare(`select 1 from "agentSession" where "sessionId" = ?1`).bind(sessionId).first());
}

// Routes an agent token may never call, whatever the user's rules say.
const HUMAN_ONLY: [string, RegExp][] = [
  ["PUT", /^\/api\/delegate\/policy$/],
  ["*", /^\/api\/connectors\/(slack|gmail|outlook)(\/(start|callback))?$/],
  ["PUT", /^\/api\/me\/profile$/],
  ["GET", /^\/api\/discord\/(install|callback)$/],
  ["POST", /^\/api\/projects\/[^/]+\/(discord|members)/],
  ["DELETE", /^\/api\/projects\/[^/]+\/(discord|members)/],
  ["PUT", /^\/api\/organizations\/[^/]+\/(members|manufact|grants)/],
  ["DELETE", /^\/api\/organizations\/[^/]+\/(members|manufact)/],
  ["POST", /^\/api\/organizations\/[^/]+\/requests\/[^/]+\/decision$/],
  ["DELETE", /^\/api\/approval-keys\//],
  ["DELETE", /^\/api\/artifacts\/[^/]+$/],
];
// Of Better Auth's own endpoints, an agent session may only read itself or sign out
// (no approving device logins, changing email, linking accounts or listing/revoking sessions).
const AGENT_AUTH_OK = /^\/api\/auth\/(get-session|sign-out)$/;

export function agentForbidden(method: string, path: string): boolean {
  if (path.startsWith("/api/auth/")) return !AGENT_AUTH_OK.test(path);
  return HUMAN_ONLY.some(([m, re]) => (m === "*" || m === method) && re.test(path));
}

const b64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

// The exact bytes a device signs to approve one request. Built from the server's own record, so a panel that showed
// a different summary (or another request) produces a signature that doesn't verify.
export const approvalMessage = (id: string, userId: string, summary: string) => `anydock-approve:v1\n${id}\n${userId}\n${summary}`;

export async function verifyDeviceApproval(
  env: Env, sessionId: string, row: { id: string; userId: string; summary: string }, signatureB64: string,
): Promise<{ ok: boolean; keyName?: string }> {
  const key = await env.DB.prepare(`select "publicKey", "name" from "approvalKey" where "sessionId" = ?1 and "userId" = ?2`)
    .bind(sessionId, row.userId)
    .first<{ publicKey: string; name: string }>();
  if (!key) return { ok: false };
  try {
    const pub = await crypto.subtle.importKey("raw", b64(key.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" }, pub, b64(signatureB64), new TextEncoder().encode(approvalMessage(row.id, row.userId, row.summary)),
    );
    return { ok, keyName: key.name };
  } catch {
    return { ok: false };
  }
}

// Called right after /api/auth/device/token succeeds: mark the new session as an agent session, and enroll the
// device's approval key if the CLI sent one. The person approved this exact login in their browser.
export async function recordDeviceLogin(env: Env, accessToken: string, body: Record<string, unknown>): Promise<void> {
  const s = await env.DB.prepare(`select "id", "userId" from "session" where "token" = ?1`).bind(accessToken).first<{ id: string; userId: string }>();
  if (!s) return;
  const stmts = [env.DB.prepare(`insert or ignore into "agentSession" ("sessionId","userId","createdAt") values (?1,?2,?3)`).bind(s.id, s.userId, now())];
  const pk = typeof body.approval_key === "string" ? body.approval_key : "";
  let raw: Uint8Array | null = null;
  try { raw = pk ? b64(pk) : null; } catch {}
  if (raw && raw.length === 65 && raw[0] === 4) {
    const name = (typeof body.approval_key_name === "string" ? body.approval_key_name : "This device").slice(0, 80);
    stmts.push(
      env.DB.prepare(`insert into "approvalKey" ("id","userId","sessionId","publicKey","name","createdAt") values (?1,?2,?3,?4,?5,?6)`)
        .bind(crypto.randomUUID(), s.userId, s.id, pk, name, now()),
    );
  }
  await env.DB.batch(stmts);
}

export const isAgent = (c: Context<AppEnv>) => c.get("agent") === true;
