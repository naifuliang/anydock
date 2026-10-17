import type { AuthEnv } from "./auth.ts";

interface Email {
  to: string;
  subject: string;
  text: string;
}

// Sends through Primitive when configured; otherwise logs, so local dev works without keys.
export async function sendEmail(env: AuthEnv, email: Email): Promise<void> {
  if (!env.PRIMITIVE_API_KEY || !env.EMAIL_FROM) {
    console.log(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  // EMAIL_FROM is an address on the org's managed subdomain, e.g. login@<org>.primitive.email
  const res = await fetch("https://api.primitive.dev/v1/send-mail", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.PRIMITIVE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: email.to, subject: email.subject, body_text: email.text }),
  });
  if (!res.ok) {
    throw new Error(`Primitive send failed: ${res.status} ${await res.text()}`);
  }
}
