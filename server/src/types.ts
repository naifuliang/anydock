import type { Auth, AuthEnv } from "./auth.ts";

export interface Env extends AuthEnv {
  DB: D1Database;
  TRAJECTORIES: R2Bucket;
  HUB: DurableObjectNamespace;
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
}

export type Session = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
export type User = Session["user"];

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: Auth; session: Session | null; user: User };
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
