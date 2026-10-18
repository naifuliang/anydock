-- A Discord channel connected to a project: shares/handovers of the project's works post there,
-- and /anydock slash commands in that channel answer from the project's works.
create table "discordLink" (
  "id" text not null primary key,
  "projectId" text not null references "project" ("id") on delete cascade,
  "guildId" text not null,
  "guildName" text,
  "channelId" text not null,
  "channelName" text,
  "createdBy" text not null references "user" ("id") on delete cascade,
  "createdAt" text not null,
  unique ("projectId", "channelId")
);
create index "discordLink_channelId_idx" on "discordLink" ("channelId");
