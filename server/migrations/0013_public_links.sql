-- Public links: an artifact the owner (or an approved agent) made viewable by anyone with the link.
alter table "artifact" add column "publicToken" text;
alter table "artifact" add column "publicAt" text;
create unique index "artifact_public_token" on "artifact" ("publicToken");
