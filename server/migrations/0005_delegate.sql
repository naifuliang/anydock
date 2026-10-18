-- Delegate: agents act on a person's behalf through tools that person connected, under that person's rules.

-- A tool a person connected once. Tokens are AES-GCM encrypted (src/secure.ts); agents never see them.
create table "connection" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  "provider" text not null,          -- slack
  "externalId" text,                 -- e.g. slack "<team_id>:<user_id>"
  "label" text,                      -- e.g. workspace name
  "accessToken" text,                -- encrypted: acts as the person
  "botToken" text,                   -- encrypted: AnyDock's own identity in that tool (approval DMs)
  "scopes" text,
  "createdAt" text not null,
  "updatedAt" text not null,
  unique ("userId", "provider")
);

-- A person's rule for one kind of action. Missing row = the action's default.
create table "policy" (
  "userId" text not null references "user" ("id") on delete cascade,
  "action" text not null,            -- slack.post | email.internal | email.external | …
  "decision" text not null,          -- allow | ask | deny
  "updatedAt" text not null,
  primary key ("userId", "action")
);

-- Every action an agent asked for: the approval queue and the audit log in one table.
create table "actionRequest" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  "agent" text,                      -- which agent asked, e.g. claude-code
  "action" text not null,
  "payload" text not null,           -- JSON
  "summary" text not null,           -- one line for people
  "status" text not null,            -- pending | approved | denied | blocked | executed | failed
  "decision" text,                   -- the rule that applied: allow | ask | deny
  "decidedVia" text,                 -- rule | dashboard | slack | agent
  "result" text,                     -- JSON (message link, error…)
  "createdAt" text not null,
  "decidedAt" text,
  "executedAt" text
);
create index "actionRequest_user_idx" on "actionRequest" ("userId", "createdAt");
