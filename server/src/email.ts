import type { AuthEnv } from "./auth.ts";

interface Email { to: string; subject: string; text: string }

// Platform account mail belongs to AnyDock infrastructure, never to a tenant's
// Primitive resource or to a user's connected Gmail/Outlook mailbox.
export async function sendEmail(env: AuthEnv, email: Email): Promise<void> {
  if (env.EMAIL) {
    await env.EMAIL.send({
      from: { email: env.SYSTEM_EMAIL_FROM || "login@anydock.ai", name: "AnyDock" },
      to: email.to, subject: email.subject, text: email.text,
    });
    return;
  }
  if (env.BETTER_AUTH_URL.startsWith("http://localhost")) {
    console.log(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  throw new Error("AnyDock system email is not configured.");
}
