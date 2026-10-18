-- Per-person settings that aren't auth: a phone for texts (Inkbox) and whether to be texted on handovers.
create table "profile" (
  "userId" text not null primary key references "user" ("id") on delete cascade,
  "phone" text,                       -- E.164, e.g. +14155550123
  "textOnHandover" integer not null default 0,
  "updatedAt" text not null
);
