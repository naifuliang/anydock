-- Per agent session permissions. Each Claude Code / Codex session (source + sessionId, on one CLI login) inherits the
-- person's rules and can only differ within them: narrowed (ask / deny), or allowed for that session alone after the
-- person approved "for this session". A session rule never outlives its expiry or its CLI login.
create table "sessionRule" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  "cliSessionId" text,                    -- the CLI login it was made for (null = any login of this person)
  "source" text not null,                 -- claude-code | codex
  "sessionId" text not null,              -- the agent's own session id
  "action" text not null,
  "decision" text not null,               -- allow | ask | deny
  "scope" text,                           -- JSON {to?: string[]} for allow
  "createdVia" text not null,             -- dashboard | mac | slack
  "requestId" text,                       -- the approval that created it
  "expiresAt" text not null,
  "createdAt" text not null,
  "revokedAt" text
);
create index "sessionRule_lookup" on "sessionRule" ("userId", "source", "sessionId", "action");

-- Which agent session asked (when known), so approvals can be "for this session" and the activity log can show it.
alter table "actionRequest" add column "source" text;
alter table "actionRequest" add column "sessionId" text;
alter table "actionRequest" add column "cliSessionId" text;
