-- AnyDock domain tables. Auth tables ("user", "session", …) live in 0001_auth.sql.
-- Timestamps are ISO-8601 text; ids are random text ids.

-- A team space that local projects can be linked to (Visibility: Project).
create table "project" (
  "id" text not null primary key,
  "name" text not null,
  "ownerId" text not null references "user" ("id") on delete cascade,
  "createdAt" text not null
);

create table "projectMember" (
  "projectId" text not null references "project" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "role" text not null default 'member', -- owner | member
  "createdAt" text not null,
  primary key ("projectId", "userId")
);

-- One agent session (Claude Code, Codex, …) uploaded by its owner.
-- Visibility: private (default, never uploaded unless authorized) | project | shared.
create table "work" (
  "id" text not null primary key,
  "ownerId" text not null references "user" ("id") on delete cascade,
  "source" text not null,          -- claude-code | codex
  "sessionId" text not null,       -- the agent's own session id
  "title" text not null,
  "cwd" text,
  "gitBranch" text,
  "summary" text,                  -- distilled: what was done and why
  "method" text,                   -- distilled: reusable playbook (markdown)
  "visibility" text not null default 'private',
  "projectId" text references "project" ("id") on delete set null,
  "stepCount" integer not null default 0,
  "trajectoryKey" text,            -- R2 object key of the normalized trajectory
  "lastActivityAt" text,
  "createdAt" text not null,
  "updatedAt" text not null,
  unique ("ownerId", "source", "sessionId")
);
create index "work_ownerId_idx" on "work" ("ownerId");
create index "work_projectId_idx" on "work" ("projectId");

-- A share or handover of one work to one person.
-- toUserId is null until someone with toEmail signs up; it is filled in on first sign-in.
create table "share" (
  "id" text not null primary key,
  "workId" text not null references "work" ("id") on delete cascade,
  "fromUserId" text not null references "user" ("id") on delete cascade,
  "toUserId" text references "user" ("id") on delete cascade,
  "toEmail" text not null,
  "kind" text not null,            -- share | handover
  "note" text,
  "revokedAt" text,
  "createdAt" text not null
);
create index "share_workId_idx" on "share" ("workId");
create index "share_toUserId_idx" on "share" ("toUserId");
create index "share_toEmail_idx" on "share" ("toEmail");

-- What a user sees as new: shares, handovers, questions about their work.
create table "inboxItem" (
  "id" text not null primary key,
  "userId" text references "user" ("id") on delete cascade,
  "toEmail" text not null,
  "kind" text not null,            -- share | handover | question
  "workId" text references "work" ("id") on delete cascade,
  "shareId" text references "share" ("id") on delete cascade,
  "fromUserId" text references "user" ("id") on delete set null,
  "body" text,
  "readAt" text,
  "createdAt" text not null
);
create index "inboxItem_userId_idx" on "inboxItem" ("userId", "createdAt");
create index "inboxItem_toEmail_idx" on "inboxItem" ("toEmail");
