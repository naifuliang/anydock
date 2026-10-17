import { betterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization, emailOTP } from "better-auth/plugins";
import { sendEmail } from "./email.ts";

export interface AuthEnv {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  PRIMITIVE_API_KEY?: string;
  EMAIL_FROM?: string;
}

// The CLI identifies itself with this client id during the device flow.
export const CLI_CLIENT_ID = "anydock-cli";

// Shared by the Worker and the schema generator, so both see the same tables.
export function authOptions(env: AuthEnv, database: BetterAuthOptions["database"]): BetterAuthOptions {
  const socialProviders: BetterAuthOptions["socialProviders"] = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }

  return {
    appName: "AnyDock",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database,
    socialProviders,
    account: { accountLinking: { enabled: true, trustedProviders: ["github", "google", "email-otp"] } },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp }) {
          await sendEmail(env, {
            to: email,
            subject: `Your AnyDock code: ${otp}`,
            text: `Your AnyDock sign-in code is ${otp}. It expires in 10 minutes.`,
          });
        },
      }),
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
      bearer(),
    ],
  };
}

export function createAuth(env: AuthEnv, database: BetterAuthOptions["database"]) {
  return betterAuth(authOptions(env, database));
}

export type Auth = ReturnType<typeof createAuth>;
