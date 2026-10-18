import type { Auth, AuthEnv } from "./auth.ts";

export interface Env extends AuthEnv {
  DB: D1Database;
  TRAJECTORIES: R2Bucket;
  HUB: DurableObjectNamespace;
  ROOM: DurableObjectNamespace;
  USERCONTENT_ORIGIN?: string; // where apps run, e.g. https://u.anydock.ai (local: http://127.0.0.1:8787)
  // Discord connector (see tasks/discord-setup.md). All three are needed for it to turn on.
  DISCORD_APPLICATION_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_API?: string; // override for tests; default https://discord.com/api/v10
  // Slack connector for delegate (see tasks/slack-app-setup.md).
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_API?: string; // override for tests; default https://slack.com/api
  // Email as you (tasks/email-accounts-setup.md). Gmail reuses GOOGLE_CLIENT_ID/SECRET.
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  // Test overrides.
  GOOGLE_OAUTH_URL?: string;
  GOOGLE_TOKEN_URL?: string;
  GMAIL_API?: string;
  MS_LOGIN_URL?: string;
  MS_GRAPH_API?: string;
  // Inkbox (tasks/inkbox-setup.md).
  INKBOX_API_KEY?: string;
  INKBOX_IDENTITY_ID?: string;
  INKBOX_PHONE_NUMBER_ID?: string;
  INKBOX_API?: string; // test override; default https://inkbox.ai/api/v1
  MANUFACT_API?: string; // test override; production uses the fixed Manufact REST origin
}

export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
export type User = Session["user"];

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: Auth; session: Session | null; user: User; agent: boolean };
};

export interface WorkRow {
  id: string;
  ownerId: string;
  source: string;
  sessionId: string;
  title: string;
  cwd: string | null;
  gitBranch: string | null;
  summary: string | null;
  method: string | null;
  visibility: "private" | "project" | "shared";
  projectId: string | null;
  stepCount: number;
  trajectoryKey: string | null;
  lastActivityAt: string | null;
  assigneeId: string | null;
  assigneeEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

// Live-push events delivered over /api/live.
export type LiveEvent =
  | { type: "inbox.new"; item: unknown }
  | { type: "work.updated"; workId: string; stepCount: number; updatedAt: string }
  | { type: "action.new" | "action.updated"; action: unknown };
