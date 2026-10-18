// "Share this with Jason": resolve a teammate by name among the people you already work with — those you've shared or
// handed work to (or received from), co-members of your projects and organizations. Emails pass straight through.
export type Resolved = { email: string } | { error: string; message: string };

export async function resolveTeammate(db: D1Database, meId: string, to: string): Promise<Resolved> {
  const raw = to.trim();
  if (raw.includes("@") && !raw.startsWith("@")) return { email: raw.toLowerCase() };
  const q = raw.replace(/^@/, "").toLowerCase();
  if (!q) return { error: "invalid_recipient", message: "Say who to send it to — a teammate's name or email." };
  const { results } = await db.prepare(
    `select distinct u."id", u."name", u."email" from "user" u where u."id" != ?1 and (
       u."id" in (select "toUserId" from "share" where "fromUserId" = ?1)
       or u."id" in (select "fromUserId" from "share" where "toUserId" = ?1)
       or u."id" in (select "toUserId" from "artifactShare" where "createdBy" = ?1)
       or u."id" in (select "createdBy" from "artifactShare" where "toUserId" = ?1)
       or u."id" in (select m2."userId" from "projectMember" m1 join "projectMember" m2 on m2."projectId" = m1."projectId" where m1."userId" = ?1)
       or u."id" in (select o2."userId" from "organizationMember" o1 join "organizationMember" o2 on o2."organizationId" = o1."organizationId" where o1."userId" = ?1)
       or u."id" in (select "assigneeId" from "work" where "ownerId" = ?1)
       or u."id" in (select "ownerId" from "work" where "assigneeId" = ?1))`,
  ).bind(meId).all<{ id: string; name: string | null; email: string }>().catch(() => ({ results: [] as { id: string; name: string | null; email: string }[] }));
  const name = (u: { name: string | null }) => (u.name ?? "").trim().toLowerCase();
  let hits = results.filter((u) => name(u) === q);
  if (!hits.length) hits = results.filter((u) => name(u).split(/\s+/)[0] === q);
  if (!hits.length) hits = results.filter((u) => u.email.toLowerCase().split("@")[0] === q);
  if (hits.length === 1) return { email: hits[0]!.email.toLowerCase() };
  if (hits.length > 1) return { error: "ambiguous_recipient", message: `More than one teammate matches "${raw}": ${hits.map((h) => h.email).join(", ")}. Use their email.` };
  return { error: "unknown_recipient", message: `No teammate called "${raw}" yet. Use their email the first time, or add them to one of your projects.` };
}
