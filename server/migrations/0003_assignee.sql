-- Handover moves responsibility, not authorship: the owner keeps uploading the trajectory from their
-- machine, the assignee is who is responsible for the work now. Email is kept so a handover to someone
-- without an account resolves when they sign in.
alter table "work" add column "assigneeId" text references "user" ("id") on delete set null;
alter table "work" add column "assigneeEmail" text;
