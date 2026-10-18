// Artifacts end to end against local wrangler dev: create (skeleton → fill), sheets, LaTeX/HTML, apps, files,
// access rules, share / handover, the Work link, live room events and the sandboxed app origin.
// Usage: npx wrangler dev > dev.log 2>&1 &   then   node test/artifacts-e2e.mjs dev.log
import { readFileSync } from "node:fs";

const BASE = "http://localhost:8787";
const LOG = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? "  " + extra : ""}`); if (!ok) failures++; };

async function call(token, method, path, body, headers = {}) {
  const raw = body instanceof Uint8Array || typeof body === "string";
  const res = await fetch(BASE + path, { method, redirect: "manual",
    headers: { origin: BASE, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !raw ? { "content-type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
async function signIn(email) {
  await call(null, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
  await sleep(800);
  const lines = readFileSync(LOG, "utf8").split("\n");
  const otp = lines.slice(lines.findLastIndex((l) => l.includes(`to=${email}`) || l === `To: ${email}`)).join("\n").match(/(?:sign-in code is|AnyDock code:) (\d{6})/)[1];
  return (await call(null, "POST", "/api/auth/sign-in/email-otp", { email, otp })).headers.get("set-auth-token");
}

const run = Date.now();
const nolanEmail = `nolan+${run}@acme.dev`, jasonEmail = `jason+${run}@acme.dev`, eveEmail = `eve+${run}@acme.dev`;
const nolan = await signIn(nolanEmail), jason = await signIn(jasonEmail), eve = await signIn(eveEmail);

// Live room: Jason will watch the doc once he has access.
// ---------- doc: skeleton first, then fill ----------
const created = await call(nolan, "POST", "/api/artifacts", {
  title: "Sponsor research", kind: "doc", source: "claude-code", sessionId: `sess-${run}`,
  outline: [{ heading: "Sponsor research", level: 1, brief: "One-line summary" }, { heading: "Primitive", brief: "What they offer" }, { heading: "Inkbox" }, { heading: "Recommendation" }],
});
const doc = created.data.artifact;
check("create a doc with a skeleton", created.status === 201 && doc.kind === "doc" && doc.url.endsWith(`/a/${doc.id}`));
let full = (await call(nolan, "GET", `/api/artifacts/${doc.id}`)).data;
check("skeleton sections are 'todo' with briefs", full.sections.length === 4 && full.sections.every((s) => s.status === "todo") && full.sections[1].brief === "What they offer");

// Jason has no access yet.
check("others can't see it", (await call(jason, "GET", `/api/artifacts/${doc.id}`)).status === 404);

const sec = full.sections[1];
const w = await call(nolan, "PUT", `/api/artifacts/${doc.id}/sections/${sec.id}`, { body: "Agent email: **send**, receive, reply." });
check("fill a section → done", w.status === 200 && w.data.section.status === "done");
const text = (await call(nolan, "GET", `/api/artifacts/${doc.id}/text`)).data;
check("text export is Markdown with headings and todo markers", text.startsWith("# Sponsor research") && text.includes("## Primitive\n\nAgent email: **send**") && text.includes("<!-- todo: One-line summary -->"), JSON.stringify(text.slice(0, 120)));
const one = (await call(nolan, "GET", `/api/artifacts/${doc.id}/text?section=Primitive`)).data;
check("read one section by heading", one.trim() === "## Primitive\n\nAgent email: **send**, receive, reply.");

const added = await call(nolan, "POST", `/api/artifacts/${doc.id}/sections`, { heading: "Risks", after: sec.id, body: "Time." });
full = (await call(nolan, "GET", `/api/artifacts/${doc.id}`)).data;
check("insert a section after another", added.status === 201 && full.sections.map((s) => s.heading).join("|") === "Sponsor research|Primitive|Risks|Inkbox|Recommendation");

// ---------- share, locks, live ----------
const sh = await call(nolan, "POST", `/api/artifacts/${doc.id}/share`, { to: jasonEmail, role: "editor" });
check("share with a teammate as editor", sh.status === 201);
const inbox = (await call(jason, "GET", "/api/inbox")).data.items;
check("it lands in their inbox", inbox.some((i) => i.kind === "artifact.share" && i.artifactId === doc.id && i.artifactTitle === "Sponsor research"));
const jv = await call(jason, "GET", `/api/artifacts/${doc.id}`);
check("they can open and edit it", jv.status === 200 && jv.data.artifact.access === "edit");

const events = [];
const ws = new WebSocket(`${BASE.replace("http", "ws")}/api/artifacts/${doc.id}/live?token=${encodeURIComponent(jason)}`);
ws.onmessage = (m) => { try { events.push(JSON.parse(m.data)); } catch {} };
await new Promise((r) => (ws.onopen = r));
await sleep(300);
check("live room greets and lists who's here", events.some((e) => e.type === "hello") && events.some((e) => e.type === "presence" && e.people.length >= 1));

const inkbox = full.sections.find((s) => s.heading === "Inkbox");
const lock = await call(jason, "POST", `/api/artifacts/${doc.id}/sections/${inkbox.id}/lock`, { on: true });
check("Jason locks a section to edit it", lock.status === 200);
const blocked = await call(nolan, "PUT", `/api/artifacts/${doc.id}/sections/${inkbox.id}`, { body: "overwrite" });
check("…so Nolan's agent can't overwrite it meanwhile", blocked.status === 409 && /editing/.test(blocked.data.message), blocked.data.message);
const other = await call(nolan, "PUT", `/api/artifacts/${doc.id}/sections/${full.sections.find((s) => s.heading === "Recommendation").id}`, { body: "Build AnyDock." });
check("…but can write another section at the same time", other.status === 200);
await sleep(400);
check("the edit reaches Jason live", events.some((e) => e.type === "section.updated" && e.section.body === "Build AnyDock." && e.by?.name));
await call(jason, "PUT", `/api/artifacts/${doc.id}/sections/${inkbox.id}`, { body: "Agent identity: email, phone, iMessage." });
await call(jason, "POST", `/api/artifacts/${doc.id}/sections/${inkbox.id}/lock`, { on: false });
check("after unlocking, anyone can edit again", (await call(nolan, "PUT", `/api/artifacts/${doc.id}/sections/${inkbox.id}`, { body: "Agent identity (email, phone, iMessage)." })).status === 200);

// ---------- viewer can't edit, outsider can't see ----------
await call(nolan, "POST", `/api/artifacts/${doc.id}/share`, { to: eveEmail, role: "viewer" });
check("viewer can read", (await call(eve, "GET", `/api/artifacts/${doc.id}/text`)).status === 200);
check("viewer can't edit", (await call(eve, "PUT", `/api/artifacts/${doc.id}/sections/${inkbox.id}`, { body: "x" })).status === 403);

// ---------- handover ----------
const ho = await call(nolan, "POST", `/api/artifacts/${doc.id}/handover`, { to: jasonEmail, note: "Finish the summary" });
const after = (await call(jason, "GET", `/api/artifacts/${doc.id}`)).data;
check("hand over → recipient becomes owner", ho.status === 201 && after.artifact.access === "owner");
check("previous owner keeps edit access", (await call(nolan, "GET", `/api/artifacts/${doc.id}`)).data.artifact.access === "edit");
check("history records who did what (agent or person)", after.events.some((e) => e.kind === "handed_over") && after.events.some((e) => e.kind === "section.updated" && e.actorName));

// ---------- the Work link: it moves with the work ----------
const pre = (await call(nolan, "POST", "/api/artifacts", { title: "Draft", kind: "doc", content: "# Draft", source: "claude-code", sessionId: `sess-${run}` })).data.artifact;
check("before its session is synced, an artifact has no Work", pre.workId === null);
const work = (await call(nolan, "PUT", "/api/works", { source: "claude-code", sessionId: `sess-${run}`, title: "Hackathon research" })).data.work;
const linked = (await call(nolan, "POST", "/api/artifacts", { title: "Notes", kind: "doc", content: "# Notes\n\nhi", source: "claude-code", sessionId: `sess-${run}` })).data.artifact;
check("artifacts made in a synced session join its Work", linked.workId === work.id);
check("earlier artifacts from that session were linked when the Work appeared", (await call(nolan, "GET", `/api/artifacts/${pre.id}`)).data.artifact.workId === work.id);
check("work-only teammate can't see it yet", (await call(eve, "GET", `/api/artifacts/${linked.id}`)).status === 404);
await call(nolan, "POST", `/api/works/${work.id}/handover`, { to: eveEmail });
check("hand over the Work → its artifacts are editable by the new assignee", (await call(eve, "GET", `/api/artifacts/${linked.id}`)).data.artifact?.access === "edit");
check("filter artifacts by work", (await call(nolan, "GET", `/api/artifacts?workId=${work.id}`)).data.artifacts.length === 2);

// ---------- sheet ----------
const sheet = (await call(nolan, "POST", "/api/artifacts", { title: "Budget", kind: "sheet", rows: [["Item", "Cost"], ["Credits", 100], ["Total", "=SUM(B2:B2)"]] })).data.artifact;
const sid = (await call(nolan, "GET", `/api/artifacts/${sheet.id}`)).data.sections[0].id;
await Promise.all([
  call(nolan, "POST", `/api/artifacts/${sheet.id}/sheet/${sid}/cells`, { cells: [{ r: 3, c: 0, v: "Food" }] }),
  call(nolan, "POST", `/api/artifacts/${sheet.id}/sheet/${sid}/cells`, { cells: [{ r: 3, c: 1, v: 40 }] }),
]);
const csv = (await call(nolan, "GET", `/api/artifacts/${sheet.id}/text`)).data;
check("concurrent cell edits both land", csv.includes("Food,40") && csv.includes("Credits,100"), JSON.stringify(csv));
check("csv import works", (await call(nolan, "POST", "/api/artifacts", { title: "Imported", kind: "sheet", content: 'a,b\n"x, y",2\n' })).status === 201);

// ---------- latex / html / app / file ----------
const tex = (await call(nolan, "POST", "/api/artifacts", { title: "Paper", kind: "latex", content: "\\documentclass{article}\\begin{document}Hi\\end{document}" })).data.artifact;
check("latex keeps its source", (await call(nolan, "GET", `/api/artifacts/${tex.id}/text`)).data.includes("\\documentclass"));
const page = (await call(nolan, "POST", "/api/artifacts", { title: "Landing", kind: "html", content: "<h1>Hello</h1><script>1</script>" })).data.artifact;
const served = await fetch(page.appUrl);
check("html runs on the separate content origin (not the app's)", served.status === 200 && (await served.text()).includes("<h1>Hello") && new URL(page.appUrl).origin !== BASE, page.appUrl);
check("a wrong capability is refused", (await fetch(page.appUrl.replace(/\/[0-9a-f]{32}\//, "/0000/"))).status === 404);

const app = (await call(nolan, "POST", "/api/artifacts", { title: "Timer", kind: "app" })).data.artifact;
const v = (await call(nolan, "POST", `/api/artifacts/${app.id}/versions`)).data.version;
await call(nolan, "PUT", `/api/artifacts/${app.id}/versions/${v}/files/index.html`, "<script src='app.js'></script><p>Timer</p>", { "content-type": "text/html" });
await call(nolan, "PUT", `/api/artifacts/${app.id}/versions/${v}/files/app.js`, "console.log(1)", { "content-type": "text/javascript" });
await call(nolan, "POST", `/api/artifacts/${app.id}/versions/${v}/done`);
const appIndex = await fetch(app.appUrl), appJs = await fetch(app.appUrl + "app.js");
check("app files are served sandboxed (index + assets)", appIndex.status === 200 && (await appIndex.text()).includes("Timer") && appJs.headers.get("content-type") === "text/javascript");
const v2 = (await call(nolan, "POST", `/api/artifacts/${app.id}/versions`)).data.version;
await call(nolan, "PUT", `/api/artifacts/${app.id}/versions/${v2}/files/index.html`, "<p>Timer v2</p>", { "content-type": "text/html" });
check("a new version replaces what runs", v2 === v + 1 && (await (await fetch(app.appUrl)).text()).includes("v2"));
check("versions are listed", (await call(nolan, "GET", `/api/artifacts/${app.id}/versions`)).data.versions.length === 2);

const file = (await call(nolan, "POST", "/api/artifacts", { title: "Deck.pptx", kind: "file", format: "pptx" })).data.artifact;
const fv = (await call(nolan, "POST", `/api/artifacts/${file.id}/versions`)).data.version;
const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3]);
await call(nolan, "PUT", `/api/artifacts/${file.id}/versions/${fv}/files/Deck.pptx`, bytes, { "content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
const dl = await fetch(`${BASE}/api/artifacts/${file.id}/files/Deck.pptx`, { headers: { authorization: `Bearer ${nolan}` } });
check("office files round-trip byte for byte", dl.status === 200 && Buffer.from(await dl.arrayBuffer()).equals(Buffer.from(bytes)));
const htmlFile = (await call(nolan, "POST", "/api/artifacts", { title: "x", kind: "file", format: "html" })).data.artifact;
const hv = (await call(nolan, "POST", `/api/artifacts/${htmlFile.id}/versions`)).data.version;
await call(nolan, "PUT", `/api/artifacts/${htmlFile.id}/versions/${hv}/files/x.html`, "<script>alert(1)</script>", { "content-type": "text/html" });
const hdl = await fetch(`${BASE}/api/artifacts/${htmlFile.id}/files/x.html`, { headers: { authorization: `Bearer ${nolan}` } });
check("uploaded HTML is never served as a page on the app's origin", hdl.headers.get("content-type") === "application/octet-stream" && /sandbox/.test(hdl.headers.get("content-security-policy")));

// ---------- the page ----------
const pageRes = await fetch(`${BASE}/a/${doc.id}`, { headers: { authorization: `Bearer ${jason}` }, redirect: "manual" });
check("artifact page renders for someone with access", pageRes.status === 200 && (await pageRes.text()).includes("window.BOOT"));
check("artifact page asks strangers to sign in", (await fetch(`${BASE}/a/${doc.id}`, { redirect: "manual" })).status === 302);

ws.close();
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
