import type { Auth, AuthEnv } from "./auth.ts";

export interface Env extends AuthEnv {
  DB: D1Database;
  TRAJECTORIES: R2Bucket;
  HUB: DurableObjectNamespace;
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
  | { type: "work.updated"; workId: string; stepCount: number; updatedAt: string };
