-- Artifacts: what work produces (docs, decks, sheets, LaTeX, web pages, small apps, Office/PDF files).
-- Each can belong to a Work (so it moves with share / handover and keeps its provenance) and be shared on its own.
create table "artifact" (
  "id" text not null primary key,
  "ownerId" text not null references "user" ("id") on delete cascade,
  "title" text not null,
  "kind" text not null,                 -- doc | slides | sheet | latex | html | app | file
  "format" text not null,               -- md | tex | html | csv | docx | pptx | xlsx | pdf | … (the original format)
  "workId" text references "work" ("id") on delete set null,
  "source" text,                        -- agent session that made it (claude-code | codex) …
  "sessionId" text,                     -- … so it joins that session's Work when the session is synced
  "version" integer not null default 1, -- bumps on every file upload
  "createdAt" text not null,
  "updatedAt" text not null,
  "updatedBy" text
);
create index "artifact_owner" on "artifact" ("ownerId", "updatedAt");
create index "artifact_work" on "artifact" ("workId");
create index "artifact_session" on "artifact" ("source", "sessionId");

-- Live-editable content. doc/slides: one row per section/slide, so an agent can lay down the skeleton first and fill it
-- in, and people and agents can edit different sections at once. sheet: one row per tab, body = JSON rows.
-- latex/html: one row holding the source.
create table "artifactSection" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "position" real not null,
  "heading" text not null default '',
  "level" integer not null default 2,
  "brief" text,                          -- what this section should say (skeleton)
  "body" text not null default '',
  "status" text not null default 'todo', -- todo | writing | done
  "lockedBy" text,
  "lockedName" text,
  "lockedUntil" text,
  "updatedBy" text,
  "updatedName" text,
  "updatedAt" text not null
);
create index "artifactSection_artifact" on "artifactSection" ("artifactId", "position");

-- Uploaded files, versioned (Office/PDF originals, compiled PDFs, every file of a small app). Bytes live in R2.
create table "artifactFile" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "version" integer not null,
  "path" text not null,
  "r2Key" text not null,
  "contentType" text not null,
  "size" integer not null,
  "createdBy" text,
  "createdAt" text not null
);
create index "artifactFile_artifact" on "artifactFile" ("artifactId", "version");

create table "artifactShare" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "toUserId" text references "user" ("id") on delete cascade,
  "toEmail" text not null,
  "role" text not null,                  -- viewer | editor
  "createdBy" text,
  "createdAt" text not null,
  unique ("artifactId", "toEmail")
);
create index "artifactShare_user" on "artifactShare" ("toUserId");

-- History: who (person or agent) changed what, when.
create table "artifactEvent" (
  "id" text not null primary key,
  "artifactId" text not null references "artifact" ("id") on delete cascade,
  "at" text not null,
  "actorId" text,
  "actorName" text,
  "via" text not null,                   -- agent | web
  "kind" text not null,
  "detail" text
);
create index "artifactEvent_artifact" on "artifactEvent" ("artifactId", "at");

alter table "inboxItem" add column "artifactId" text references "artifact" ("id") on delete cascade;
