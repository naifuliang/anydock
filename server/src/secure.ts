// Small crypto helpers for delegate: encrypting stored tokens and signing short-lived state.
// Keys are derived from BETTER_AUTH_SECRET so there's no extra secret to manage.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
export const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function derived(secret: string, purpose: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", enc.encode(`${purpose}:${secret}`));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", await derived(secret, "anydock-connector-tokens"), "AES-GCM", false, ["encrypt", "decrypt"]);
}

// "v1.<iv>.<ciphertext>" — the version prefix leaves room to rotate keys later.
export async function encryptToken(secret: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), enc.encode(plain));
  return `v1.${b64url(iv)}.${b64url(ct)}`;
}

export async function decryptToken(secret: string, sealed: string): Promise<string> {
  const [v, iv, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("unknown token format");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64url(iv) }, await aesKey(secret), unb64url(ct));
  return dec.decode(plain);
}

export async function hmacB64(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

export async function hmacHex(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time-ish string compare for signatures.
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Signed, expiring state for OAuth round trips: "<payload>.<hmac>".
export async function signState(secret: string, payload: Record<string, string>): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, t: Date.now() })));
  return `${body}.${await hmacB64(`state:${secret}`, body)}`;
}

export async function readState<T extends Record<string, string>>(secret: string, state: string, maxAgeMs = 15 * 60_000): Promise<T | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig || !sameString(await hmacB64(`state:${secret}`, body), sig)) return null;
  const data = JSON.parse(dec.decode(unb64url(body))) as T & { t: number };
  return Date.now() - data.t < maxAgeMs ? data : null;
}
