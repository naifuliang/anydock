-- Mini-app file storage (recordings, attachments) — bytes in R2 under apps/<artifactId>/files/<name>.
create table "appFile" (
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "name" text not null,
  "size" integer not null,
  "contentType" text not null,
  "r2Key" text not null,
  "createdAt" text not null,
  "updatedAt" text not null,
  primary key ("artifactId", "name")
);
-- A public app accepts writes from anyone with its link only when the owner turned this on.
alter table "artifact" add column "publicSubmit" integer not null default 0;
-- "Request access" from a public link: the owner approves as editor/viewer or declines.
create table "artifactAccessRequest" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "role" text not null,            -- editor | viewer
  "note" text,
  "status" text not null,          -- pending | approved | declined
  "decidedRole" text,
  "createdAt" text not null,
  "decidedAt" text
);
create index "artifactAccessRequest_artifact" on "artifactAccessRequest" ("artifactId", "status");
