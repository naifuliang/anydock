-- Apps (artifact kind app/html) get two things on their own origin:
--  * appData: a small per-app data store (collections of JSON values), shared by everyone using the app;
--  * appGrant: permissions handed down person → agent → app. A grant is always a subset of what its grantor holds,
--    is approved by the person (granting is itself the "app.grant" action), expires, and is re-checked on every call.
create table "appGrant" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,   -- whose permissions these are
  "grantorSessionId" text,                                              -- the agent login that asked (null = the person)
  "action" text not null,                                               -- slack.post | email.internal | email.external | phone.text
  "scope" text,                                                         -- JSON {to?: string[]} — only these recipients/channels
  "requestId" text,                                                     -- the approved app.grant action request
  "expiresAt" text not null,
  "createdAt" text not null,
  "revokedAt" text
);
create index "appGrant_artifact" on "appGrant" ("artifactId", "action");

create table "appData" (
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "collection" text not null,
  "key" text not null,
  "value" text not null,
  "updatedAt" text not null,
  primary key ("artifactId", "collection", "key")
);

-- Where an app's backend is running (sandbox runtime, e.g. Blaxel), so requests can be proxied to it.
create table "appRuntime" (
  "artifactId" text not null primary key references "artifact" ("id") on delete cascade,
  "provider" text not null,
  "sandboxId" text not null,
  "url" text not null,
  "version" integer not null,
  "status" text not null,
  "updatedAt" text not null
);
