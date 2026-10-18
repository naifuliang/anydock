// "Share this with Jason": recipients by name, resolved among the people you already work with.
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/people-e2e.mjs dev.log
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };
async function call(token, method, path, body) {
  const res = await fetch(BASE + path, { method, headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`) || l === `To: ${email}`)).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  const res = await fetch(BASE + "/api/auth/sign-in/email-otp", { method: "POST", headers: { origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ email, otp }) });
  return res.headers.get("set-auth-token");
}

const run = Date.now();
const nolanEmail = `nolan+${run}@acme.dev`, jasonEmail = `jason+${run}@acme.dev`;
const nolan = await signIn(nolanEmail), jason = await signIn(jasonEmail);
await call(jason, "POST", "/api/auth/update-user", { name: "Jason Park" });
const work = (await call(nolan, "PUT", "/api/works", { source: "claude-code", sessionId: `s-${run}`, title: "Sponsor research" })).data.work;

const before = await call(nolan, "POST", `/api/works/${work.id}/share`, { to: "Jason" });
check("an unknown name gets a clear message, not a guess", before.status === 400 && before.data.error === "unknown_recipient", before.data?.message);

const project = (await call(nolan, "POST", "/api/projects", { name: "YC hackathon" })).data.project;
await call(nolan, "POST", `/api/projects/${project.id}/members`, { email: jasonEmail });
const share = await call(nolan, "POST", `/api/works/${work.id}/share`, { to: "Jason" });
check("same project → 'Jason' (first name) resolves to his email", share.status === 201 && share.data.share.toEmail === jasonEmail, JSON.stringify(share.data));
check("…and it lands in his inbox", (await call(jason, "GET", "/api/inbox")).data.items.some((i) => i.workId === work.id));

const doc = (await call(nolan, "POST", "/api/artifacts", { title: "Sponsor recommendation", kind: "doc", content: "# Rec" })).data.artifact;
const ash = await call(nolan, "POST", `/api/artifacts/${doc.id}/share`, { to: "jason park" });
check("artifacts too: full name, any case", ash.status === 201 && ash.data.share.toEmail === jasonEmail);
const ho = await call(nolan, "POST", `/api/works/${work.id}/handover`, { to: "Jason" });
check("hand over by name", ho.status === 201 && (await call(jason, "GET", `/api/works/${work.id}`)).data.work.role === "assignee");
check("emails still work as before", (await call(nolan, "POST", `/api/works/${work.id}/share`, { to: `someone+${run}@acme.dev` })).status === 201);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
