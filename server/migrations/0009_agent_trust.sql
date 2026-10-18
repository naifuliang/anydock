-- Sessions created by the CLI device flow. Agents use these tokens, so they get agent powers only:
-- they can request actions and deny them, but never approve, change rules, connect tools or approve new logins.
create table "agentSession" (
  "sessionId" text not null primary key references "session" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "createdAt" text not null
);

-- A device's approval key (macOS: a Secure Enclave P-256 key that only signs after Touch ID or the login password).
-- Enrolled together with the CLI session when the person approves the sign-in in their browser.
create table "approvalKey" (
  "id" text not null primary key,
  "userId" text not null references "user" ("id") on delete cascade,
  "sessionId" text not null references "session" ("id") on delete cascade,
  "publicKey" text not null,              -- base64 X9.63 uncompressed P-256 point (65 bytes)
  "name" text not null,
  "createdAt" text not null
);
create index "approvalKey_session" on "approvalKey" ("sessionId");
create index "approvalKey_user" on "approvalKey" ("userId");
