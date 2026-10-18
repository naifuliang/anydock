// anydock.ai/app — the signed-in dashboard. One server-rendered shell; views are plain JS over the JSON API.
import { LOGO } from "./landing.ts";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export function appPage(user: { name: string; email: string; image?: string | null }, origin: string): string {
  const boot = JSON.stringify({ user: { name: user.name, email: user.email }, origin }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnyDock</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root { --bg:#fafafa; --fg:#0a0a0b; --muted:#5d5d66; --faint:#a1a1aa; --card:#fff; --line:#e8e8eb; --soft:#f4f4f5; --hover:#f4f4f5;
          --accent:#2b59ff; --accent-soft:#eef2ff; --ok:#15803d; --ok-soft:#e8f6ec; --warn:#b45309; --warn-soft:#fdf3e4; --err:#b91c1c;
          --code:#1d1b16; --code-fg:#efece4; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d0c0a; --fg:#f2f0ea; --muted:#a29d92; --faint:#76716a; --card:#16140f; --line:#29261f; --soft:#1f1c17; --hover:#1b1914;
            --accent:#8b85ff; --accent-soft:#1d1c33; --ok:#4ade80; --ok-soft:#10261a; --warn:#fbbf24; --warn-soft:#2a210e; --err:#f87171;
            --code:#050505; --code-fg:#efece4; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14.5px/1.55 Geist, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  a { color:inherit; text-decoration:none; }
  code, .mono { font-family:"Geist Mono", ui-monospace, monospace; }
  [hidden] { display:none !important; }
  .shell { display:grid; grid-template-columns:232px 1fr; min-height:100vh; }
  aside { border-right:1px solid var(--line); padding:16px 12px; display:flex; flex-direction:column; gap:4px; position:sticky; top:0; height:100vh; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:700; letter-spacing:-.02em; font-size:16px; padding:4px 8px 16px; }
  .brand svg { color:var(--fg); }
  .nav a { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; border-radius:8px; color:var(--muted); font-weight:500; }
  .nav a:hover { background:var(--hover); color:var(--fg); }
  .nav a.on { background:var(--soft); color:var(--fg); }
  .badge { background:var(--accent); color:#fff; border-radius:99px; font-size:11px; padding:0 7px; line-height:18px; font-weight:600; }
  .me { margin-top:auto; padding:10px; border-top:1px solid var(--line); font-size:13px; color:var(--muted); }
  .me b { display:block; color:var(--fg); font-weight:600; overflow:hidden; text-overflow:ellipsis; }
  .live { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--faint); margin-top:6px; }
  .live i { width:7px; height:7px; border-radius:50%; background:var(--faint); }
  .live.on i { background:var(--ok); box-shadow:0 0 0 3px var(--ok-soft); }
  main { padding:28px 36px 60px; max-width:1100px; width:100%; }
  h1 { font-size:26px; font-weight:500; letter-spacing:-.03em; margin:0 0 4px; }
  .lead { color:var(--muted); margin:0 0 22px; }
  .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .spacer { flex:1; }
  .btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px; border:1px solid var(--line); background:var(--card);
         color:var(--fg); font:500 13.5px Geist, sans-serif; cursor:pointer; white-space:nowrap; }
  .btn:hover { border-color:var(--faint); }
  .btn.solid { background:var(--fg); color:var(--bg); border-color:var(--fg); }
  .btn.ghost { background:transparent; border-color:transparent; color:var(--muted); }
  .btn:disabled { opacity:.55; cursor:default; }
  input, select, textarea { font:inherit; color:var(--fg); background:var(--card); border:1px solid var(--line); border-radius:8px; padding:7px 10px; }
  input:focus, textarea:focus, select:focus { outline:2px solid var(--accent-soft); border-color:var(--accent); }
  .seg { display:inline-flex; background:var(--soft); border-radius:9px; padding:3px; gap:2px; }
  .seg button { border:0; background:transparent; padding:5px 12px; border-radius:7px; font:500 13px Geist, sans-serif; color:var(--muted); cursor:pointer; }
  .seg button.on { background:var(--card); color:var(--fg); box-shadow:0 1px 2px rgba(0,0,0,.08); }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; }
  .list { margin-top:16px; }
  .item { display:grid; grid-template-columns:auto 1fr auto; gap:14px; align-items:center; padding:13px 16px; border-bottom:1px solid var(--line); }
  .item:last-child { border-bottom:0; }
  a.item:hover { background:var(--hover); }
  .item .t { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .item .m { color:var(--muted); font-size:13px; }
  .src { width:30px; height:30px; border-radius:8px; display:grid; place-items:center; font:600 11px "Geist Mono", monospace; color:#fff; }
  .src.claude-code { background:#c2410c; } .src.codex { background:#0f766e; }
  .pill { display:inline-block; font-size:11.5px; border-radius:99px; padding:1px 8px; border:1px solid var(--line); color:var(--muted); font-weight:500; }
  .pill.owner { color:var(--accent); border-color:transparent; background:var(--accent-soft); }
  .pill.shared, .pill.project { color:var(--ok); border-color:transparent; background:var(--ok-soft); }
  .pill.assignee, .pill.handover { color:var(--warn); border-color:transparent; background:var(--warn-soft); }
  .pill.new { background:var(--accent); color:#fff; border-color:transparent; }
  .empty { padding:40px 20px; text-align:center; color:var(--muted); }
  .empty code { background:var(--soft); padding:2px 6px; border-radius:6px; }
  .ago { color:var(--faint); font-size:12.5px; white-space:nowrap; }

  .detail { display:grid; grid-template-columns:minmax(0, 1fr) 300px; gap:24px; align-items:start; }
  .detail > *, .step .b, .shell > main { min-width:0; }
  .side { position:sticky; top:20px; display:flex; flex-direction:column; gap:14px; }
  .side .card { padding:14px; }
  .side h3 { font-size:13px; margin:0 0 10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
  .side form { display:flex; flex-direction:column; gap:8px; }
  .meta { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; font-size:13px; }
  .meta dt { color:var(--faint); } .meta dd { margin:0; overflow:hidden; text-overflow:ellipsis; }
  .tools { display:flex; gap:8px; align-items:center; margin:14px 0 10px; }
  .tools input[type=search] { flex:1; }
  .steps { display:flex; flex-direction:column; gap:10px; }
  .step { display:grid; grid-template-columns:44px minmax(0, 1fr); gap:10px; scroll-margin-top:80px; }
  .step .i { font:500 11.5px "Geist Mono", monospace; color:var(--faint); text-align:right; padding-top:9px; }
  .step .b { border-radius:10px; padding:9px 12px; overflow-wrap:anywhere; white-space:pre-wrap; }
  .step.user .b { background:var(--soft); font-weight:500; }
  .step.assistant .b { background:var(--card); border:1px solid var(--line); }
  .step.tool .b, .step.call .b { background:transparent; padding:2px 0; white-space:normal; }
  .step details { font:12.5px/1.5 "Geist Mono", monospace; }
  .step summary { cursor:pointer; color:var(--muted); list-style:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .step summary::-webkit-details-marker { display:none; }
  .step summary b { color:var(--fg); font-weight:500; }
  .step pre { margin:6px 0 0; background:var(--code); color:var(--code-fg); padding:10px 12px; border-radius:8px; white-space:pre-wrap; overflow-wrap:anywhere; max-height:360px; overflow:auto; }
  .step.hit .b { outline:2px solid var(--accent); outline-offset:2px; }
  .step.flash .b { animation:flash 1.6s ease; }
  @keyframes flash { from { box-shadow:0 0 0 4px var(--accent-soft); } to { box-shadow:none; } }
  .why { margin:0 0 16px; padding:12px 14px; border-radius:10px; background:var(--accent-soft); font-size:13.5px; }
  .why a { color:var(--accent); font-weight:600; font-family:"Geist Mono", monospace; cursor:pointer; margin-right:6px; }
  .grid2 { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px; margin-top:16px; }
  .proj { padding:16px; display:block; }
  .proj:hover { border-color:var(--faint); }
  .proj .t { font-weight:600; font-size:15.5px; margin-bottom:6px; }
  .conn { display:grid; grid-template-columns:40px 1fr auto; gap:14px; align-items:center; padding:16px; border-bottom:1px solid var(--line); }
  .conn:last-child { border-bottom:0; }
  .conn .ic { width:40px; height:40px; border-radius:10px; display:grid; place-items:center; font-weight:700; color:#fff; }
  .toast { position:fixed; right:20px; bottom:20px; background:var(--fg); color:var(--bg); padding:11px 14px; border-radius:10px; font-size:13.5px;
           box-shadow:0 10px 30px rgba(0,0,0,.25); max-width:360px; transform:translateY(20px); opacity:0; transition:.25s; pointer-events:none; z-index:9; }
  .toast.on { transform:none; opacity:1; }
  .err { color:var(--err); font-size:13px; }
  .note { color:var(--muted); font-size:13px; }
  @media (max-width: 900px) {
    .shell { grid-template-columns:1fr; }
    aside { position:static; height:auto; flex-direction:row; align-items:center; flex-wrap:wrap; border-right:0; border-bottom:1px solid var(--line); padding:10px 12px; }
    .brand { padding:4px 8px; } .nav { display:flex; gap:2px; } .me { display:none; }
    main { padding:20px 16px 48px; }
    .detail { grid-template-columns:1fr; } .side { position:static; }
  }
</style>
</head>
<body>
<div class="shell">
  <aside>
    <a class="brand" href="/">${LOGO}AnyDock</a>
    <nav class="nav">
      <a href="#/" data-nav="works">Works</a>
      <a href="#/inbox" data-nav="inbox">Inbox <span class="badge" id="unread" hidden></span></a>
      <a href="#/projects" data-nav="projects">Projects</a>
      <a href="#/settings" data-nav="settings">Connections</a>
    </nav>
    <div class="me"><b>${esc(user.name || user.email)}</b>${esc(user.email)}<div class="live" id="live"><i></i><span>connecting…</span></div></div>
  </aside>
  <main id="view"></main>
</div>
<div class="toast" id="toast"></div>
<script>
const BOOT = ${boot};
${CLIENT}
</script>
</body></html>`;
}

// Browser code, kept as a string so the Worker serves one self-contained page.
const CLIENT = String.raw`
const $ = (s, el = document) => el.querySelector(s);
const view = $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const short = (s) => (s ?? "").split("@")[0];
function ago(iso) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago"; return Math.round(s / 86400) + "d ago";
}
async function api(method, path, body) {
  const res = await fetch(path, { method, credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401) { location.href = "/login?next=" + encodeURIComponent("/app" + location.hash); throw new Error("signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || ("HTTP " + res.status));
  return data;
}
function toast(text) { const t = $("#toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3200); }
const srcBadge = (s) => '<span class="src ' + esc(s) + '">' + (s === "codex" ? "CX" : "CC") + '</span>';
const srcName = (s) => s === "codex" ? "Codex" : "Claude Code";
const roleLabel = { owner: "yours", shared: "shared with you", assignee: "handed to you", project: "project" };

// ---------- live push ----------
const listeners = new Set();
function connectLive(attempt = 0) {
  const ws = new WebSocket(location.origin.replace(/^http/, "ws") + "/api/live");
  const el = $("#live");
  ws.onopen = () => { attempt = 0; el.classList.add("on"); el.lastElementChild.textContent = "live"; };
  ws.onmessage = (m) => {
    let ev; try { ev = JSON.parse(m.data); } catch { return; }
    if (ev.type === "inbox.new") {
      const i = ev.item;
      toast((i.fromName || short(i.fromEmail)) + (i.kind === "handover" ? " handed over " : " shared ") + '"' + i.workTitle + '"');
      refreshUnread();
    }
    listeners.forEach((fn) => fn(ev));
  };
  ws.onclose = () => { el.classList.remove("on"); el.lastElementChild.textContent = "reconnecting…"; setTimeout(() => connectLive(attempt + 1), Math.min(30000, 1000 * 2 ** attempt)); };
  setInterval(() => ws.readyState === 1 && ws.send("ping"), 30000);
}
async function refreshUnread() {
  const { items } = await api("GET", "/api/inbox?unread=1");
  const b = $("#unread"); b.textContent = items.length; b.hidden = items.length === 0;
}

// ---------- views ----------
function setNav(key) { document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === key)); }

async function worksView(filter = "all") {
  setNav("works");
  view.innerHTML = '<div class="row"><div><h1>Works</h1><p class="lead">Agent sessions you own, and ones teammates shared or handed to you.</p></div></div>' +
    '<div class="row"><div class="seg" id="seg">' + ["all", "mine", "shared"].map((f) => '<button data-f="' + f + '" class="' + (f === filter ? "on" : "") + '">' + ({ all: "All", mine: "Mine", shared: "Shared with me" })[f] + "</button>").join("") + '</div></div>' +
    '<div class="card list" id="list"><div class="empty">Loading…</div></div>';
  $("#seg").onclick = (e) => e.target.dataset.f && worksView(e.target.dataset.f);
  const { works } = await api("GET", "/api/works");
  const shown = works.filter((w) => filter === "all" || (filter === "mine" ? w.role === "owner" : w.role !== "owner"));
  $("#list").innerHTML = shown.length ? shown.map(workRow).join("") :
    '<div class="empty">' + (filter === "shared" ? "Nothing shared with you yet." :
      'No works yet. In Claude Code or Codex, say <code>share this session with a teammate@company.com</code>,<br>or run <code>anydock sync &lt;session-id&gt;</code>.') + "</div>";
}
function workRow(w) {
  return '<a class="item" href="#/w/' + w.id + '">' + srcBadge(w.source) +
    '<div style="min-width:0"><div class="t">' + esc(w.title) + '</div><div class="m">' +
    (w.role === "owner" ? "You" : esc(w.ownerName || short(w.ownerEmail))) + " · " + srcName(w.source) + " · " + w.stepCount + " steps" +
    (w.assigneeEmail ? " · → " + esc(short(w.assigneeEmail)) : "") + '</div></div>' +
    '<div class="row"><span class="pill ' + w.role + '">' + roleLabel[w.role] + '</span><span class="ago">' + ago(w.lastActivityAt || w.updatedAt) + "</span></div></a>";
}

async function inboxView() {
  setNav("inbox");
  view.innerHTML = '<h1>Inbox</h1><p class="lead">What teammates sent you. Open one to read the trajectory or ask why.</p><div class="card list" id="list"><div class="empty">Loading…</div></div>';
  const { items } = await api("GET", "/api/inbox");
  $("#list").innerHTML = items.length ? items.map((i) =>
    '<a class="item" href="#/w/' + i.workId + '" data-read="' + (i.readAt ? "" : i.id) + '">' + srcBadge(i.workSource) +
    '<div style="min-width:0"><div class="t">' + esc(i.workTitle) + '</div><div class="m">' + esc(i.fromName || i.fromEmail) +
    (i.kind === "handover" ? " handed this over to you" : " shared this with you") + (i.body ? ' — "' + esc(i.body) + '"' : "") + '</div></div>' +
    '<div class="row">' + (i.readAt ? "" : '<span class="pill new">new</span>') + '<span class="pill ' + i.kind + '">' + i.kind + '</span><span class="ago">' + ago(i.createdAt) + "</span></div></a>").join("")
    : '<div class="empty">Nothing yet. When someone shares or hands over work to you, it shows up here — live.</div>';
  view.querySelectorAll("[data-read]").forEach((a) => a.dataset.read && a.addEventListener("click", () => api("POST", "/api/inbox/" + a.dataset.read + "/read").then(refreshUnread)));
}

// Trajectory viewer.
async function workView(id) {
  setNav("works");
  view.innerHTML = '<div class="empty">Loading…</div>';
  const [{ work }, projectsRes] = await Promise.all([api("GET", "/api/works/" + id), api("GET", "/api/projects")]);
  const canShare = work.role === "owner" || work.role === "assignee";
  view.innerHTML =
    '<div class="row" style="margin-bottom:6px"><a class="btn ghost" href="#/">← Works</a></div>' +
    '<div class="row"><div style="min-width:0"><h1>' + esc(work.title) + '</h1><p class="lead">' +
    (work.role === "owner" ? "Your " : esc(work.ownerName || work.ownerEmail) + "'s ") + srcName(work.source) + ' session · <span id="count">' + work.stepCount + '</span> steps · updated ' + ago(work.lastActivityAt || work.updatedAt) + '</p></div></div>' +
    '<div class="detail"><div>' +
      '<div class="tools"><input type="search" id="q" placeholder="Ask why… or search this trajectory (e.g. why Primitive over Blaxel?)"><button class="btn" id="ask">Ask why</button>' +
      '<label class="note row" style="gap:6px"><input type="checkbox" id="showTools" checked> tools</label></div>' +
      '<div id="why" class="why" hidden></div><div class="steps" id="steps"></div><div id="more"></div>' +
    '</div><div class="side">' +
      '<div class="card"><h3>About</h3><dl class="meta">' +
        '<dt>Owner</dt><dd>' + esc(work.ownerEmail || "") + '</dd>' +
        '<dt>Access</dt><dd><span class="pill ' + work.role + '">' + roleLabel[work.role] + '</span></dd>' +
        (work.assigneeEmail ? '<dt>Assignee</dt><dd>' + esc(work.assigneeEmail) + '</dd>' : '') +
        (work.cwd ? '<dt>Folder</dt><dd class="mono" title="' + esc(work.cwd) + '">' + esc(work.cwd.split("/").slice(-2).join("/")) + '</dd>' : '') +
        (work.gitBranch ? '<dt>Branch</dt><dd class="mono">' + esc(work.gitBranch) + '</dd>' : '') +
      '</dl></div>' +
      (canShare ? '<div class="card"><h3>Share or hand over</h3><form id="shareForm"><input type="email" name="to" required placeholder="teammate@company.com">' +
        '<input name="note" placeholder="Note (optional)"><div class="row"><button class="btn solid" name="kind" value="share">Share</button><button class="btn" name="kind" value="handover">Hand over</button></div>' +
        '<div id="shareMsg" class="note"></div></form><div id="shares" style="margin-top:10px"></div></div>' : '') +
      (work.role === "owner" ? '<div class="card"><h3>Project</h3><select id="proj" style="width:100%"><option value="">Not in a project</option>' +
        projectsRes.projects.map((p) => '<option value="' + p.id + '"' + (p.id === work.projectId ? " selected" : "") + '>' + esc(p.name) + "</option>").join("") +
        '</select><p class="note" style="margin:8px 0 0">Everyone in the project can read it.</p></div>' : '') +
      '<div class="card"><h3>Pick it up in your agent</h3><p class="note" style="margin:0">In Claude Code or Codex with AnyDock installed, say:</p>' +
        '<pre class="mono" style="white-space:pre-wrap;background:var(--soft);padding:8px 10px;border-radius:8px;font-size:12px;margin:8px 0 0">read AnyDock work ' + work.id.slice(0, 8) + '… and continue it</pre></div>' +
    '</div></div>';

  let steps = [];
  const render = () => {
    const showTools = $("#showTools").checked;
    $("#steps").innerHTML = steps.map((s, i) => stepHtml(s, i, showTools)).join("") || '<div class="empty">No steps uploaded yet.</div>';
  };
  const load = async (from) => {
    for (;;) {
      const page = await api("GET", "/api/works/" + id + "/steps?from=" + from + "&limit=2000");
      steps = steps.slice(0, from).concat(page.steps); from = steps.length;
      if (from >= page.stepCount || page.steps.length === 0) break;
    }
    $("#count").textContent = steps.length;
  };
  await load(0); render();
  $("#showTools").onchange = render;

  // Live: when the owner's agent keeps working, new steps stream in.
  const onEvent = async (ev) => {
    if (ev.type !== "work.updated" || ev.workId !== id || location.hash !== "#/w/" + id) return;
    const before = steps.length; await load(before); render();
    const el = $("#steps").children[before]; el && el.classList.add("flash");
    toast((ev.stepCount - before) + " new step" + (ev.stepCount - before === 1 ? "" : "s") + " just synced");
  };
  listeners.add(onEvent); cleanup = () => listeners.delete(onEvent);

  // Ask why: lexical ranking in the browser (same idea as the MCP tool), then jump to the evidence.
  const ask = () => {
    const q = $("#q").value.trim(); const box = $("#why");
    document.querySelectorAll(".step.hit").forEach((e) => e.classList.remove("hit"));
    if (!q) { box.hidden = true; return; }
    const hits = rank(steps, q);
    if (!hits.length) { box.hidden = false; box.innerHTML = "No step mentions that. Try other words."; return; }
    box.hidden = false;
    box.innerHTML = "<b>Most relevant moments:</b> " + hits.map((i) => '<a data-go="' + i + '">[' + i + "]</a>").join("") +
      '<div class="note" style="margin-top:6px">' + esc(firstLine(steps[hits[0]])) + "</div>";
    if (!$("#showTools").checked) { $("#showTools").checked = true; render(); }
    hits.forEach((i) => document.getElementById("s" + i)?.classList.add("hit"));
    document.getElementById("s" + hits[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
    box.querySelectorAll("[data-go]").forEach((a) => a.onclick = () => document.getElementById("s" + a.dataset.go)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  $("#ask").onclick = ask; $("#q").onkeydown = (e) => e.key === "Enter" && ask();

  if (canShare) {
    const form = $("#shareForm");
    const loadShares = async () => {
      const { shares } = await api("GET", "/api/works/" + id + "/shares");
      $("#shares").innerHTML = shares.filter((s) => !s.revokedAt).map((s) =>
        '<div class="row note" style="justify-content:space-between;padding:3px 0"><span><span class="pill ' + (s.kind === "handover" ? "handover" : "shared") + '">' + s.kind + "</span> " + esc(s.toEmail) +
        '</span><button class="btn ghost" data-revoke="' + s.id + '" style="padding:2px 6px">Revoke</button></div>').join("");
      $("#shares").querySelectorAll("[data-revoke]").forEach((b) => b.onclick = async () => { await api("DELETE", "/api/shares/" + b.dataset.revoke); toast("Access revoked"); loadShares(); });
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const kind = e.submitter?.value || "share";
      const fd = new FormData(form);
      try {
        await api("POST", "/api/works/" + id + "/" + kind, { to: fd.get("to"), note: fd.get("note") || undefined });
        $("#shareMsg").textContent = (kind === "handover" ? "Handed over to " : "Shared with ") + fd.get("to"); form.reset(); loadShares();
      } catch (err) { $("#shareMsg").innerHTML = '<span class="err">' + esc(err.message) + "</span>"; }
    };
    loadShares();
  }
  const sel = $("#proj");
  if (sel) sel.onchange = async () => { await api("PUT", "/api/works/" + id + "/project", { projectId: sel.value || null }); toast(sel.value ? "Added to project" : "Removed from project"); };
}

function firstLine(s) { return ((s.text || s.input || "") + "").replace(/\s+/g, " ").slice(0, 220); }
function stepHtml(s, i, showTools) {
  if (s.type === "text") return '<div class="step ' + s.role + '" id="s' + i + '"><div class="i">' + i + '</div><div class="b">' + esc(s.text) + "</div></div>";
  if (!showTools) return "";
  const call = s.type === "tool_call";
  const head = call ? "→ <b>" + esc(s.tool || "tool") + "</b> " + esc((s.input || "").slice(0, 140)) : "← <b>" + esc(s.tool || "result") + "</b> " + esc((s.text || "").replace(/\s+/g, " ").slice(0, 140));
  return '<div class="step ' + (call ? "call" : "tool") + '" id="s' + i + '"><div class="i">' + i + '</div><div class="b"><details><summary>' + head + "</summary><pre>" + esc(call ? s.input : s.text) + "</pre></details></div></div>";
}
const STOP = new Set("the a an and or of to in on for with is are was were be it this that why how what did do does you we i my our from by at as".split(" "));
function rank(steps, q) {
  const terms = [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((t) => t.length > 1 && !STOP.has(t)))];
  return steps.map((s, i) => {
    const hay = ((s.text || "") + " " + (s.input || "") + " " + (s.tool || "")).toLowerCase();
    let score = 0; for (const t of terms) if (hay.includes(t)) score++;
    if (s.type === "text") score *= s.role === "assistant" ? 1.5 : 1.2;
    return { i, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, 8).map((x) => x.i).sort((a, b) => a - b);
}

async function projectsView() {
  setNav("projects");
  view.innerHTML = '<div class="row"><div><h1>Projects</h1><p class="lead">Team spaces. Everyone in a project can read the works linked to it.</p></div><div class="spacer"></div>' +
    '<form id="newProj" class="row"><input name="name" required placeholder="New project name"><button class="btn solid">Create</button></form></div><div class="grid2" id="grid"></div>';
  const { projects } = await api("GET", "/api/projects");
  $("#grid").innerHTML = projects.length ? projects.map((p) =>
    '<a class="card proj" href="#/p/' + p.id + '"><div class="t">' + esc(p.name) + '</div><div class="note">' + p.memberCount + " member" + (p.memberCount === 1 ? "" : "s") + " · " + p.workCount + " work" + (p.workCount === 1 ? "" : "s") +
    '</div><div style="margin-top:10px"><span class="pill ' + (p.role === "owner" ? "owner" : "project") + '">' + p.role + "</span></div></a>").join("")
    : '<div class="card empty" style="grid-column:1/-1">No projects yet. Create one, add teammates, then link works to it.</div>';
  $("#newProj").onsubmit = async (e) => { e.preventDefault(); const { project } = await api("POST", "/api/projects", { name: new FormData(e.target).get("name") }); location.hash = "#/p/" + project.id; };
}

async function projectView(id) {
  setNav("projects");
  const { project, members, works } = await api("GET", "/api/projects/" + id);
  view.innerHTML = '<div class="row" style="margin-bottom:6px"><a class="btn ghost" href="#/projects">← Projects</a></div>' +
    '<h1>' + esc(project.name) + '</h1><p class="lead">' + members.length + " member" + (members.length === 1 ? "" : "s") + " · " + works.length + " work" + (works.length === 1 ? "" : "s") + '</p>' +
    '<div class="detail"><div><div class="card list" style="margin-top:0">' + (works.length ? works.map((w) => workRow({ ...w, role: "project" })).join("") :
      '<div class="empty">No works linked yet. Open one of your works and pick this project in the sidebar.</div>') + '</div></div>' +
    '<div class="side"><div class="card"><h3>Members</h3>' + members.map((m) =>
      '<div class="row" style="justify-content:space-between;padding:4px 0"><span>' + esc(m.name || m.email) + '<br><span class="note">' + esc(m.email) + '</span></span><span class="pill ' + (m.role === "owner" ? "owner" : "project") + '">' + m.role + "</span></div>").join("") +
      '<form id="addMember" style="margin-top:12px"><input type="email" name="email" required placeholder="teammate@company.com"><button class="btn">Add member</button><div id="memberMsg" class="note"></div></form></div></div></div>';
  $("#addMember").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("POST", "/api/projects/" + id + "/members", { email: new FormData(e.target).get("email") }); projectView(id); toast("Member added"); }
    catch (err) { $("#memberMsg").innerHTML = '<span class="err">' + esc(err.message) + "</span>"; }
  };
}

function settingsView() {
  setNav("settings");
  const prod = BOOT.origin === "https://anydock.ai";
  view.innerHTML = '<h1>Connections</h1><p class="lead">Where AnyDock sends shares and handovers, and how your agents reach it.</p>' +
    '<div class="card">' +
      '<div class="conn"><div class="ic" style="background:#111">›_</div><div><b>Claude Code &amp; Codex</b><div class="note">One prompt in your agent: <code>Set up AnyDock for me: follow ' + esc(BOOT.origin) + '/agents.md</code>' +
        '<br>or a terminal: <code>curl -fsSL ' + esc(BOOT.origin) + '/install.sh | ' + (prod ? "" : "ANYDOCK_SERVER=" + esc(BOOT.origin) + " ") + 'sh</code></div></div><span class="pill shared">available</span></div>' +
      '<div class="conn"><div class="ic" style="background:#5865F2">D</div><div><b>Discord</b><div class="note">Post shares and handovers to a channel, and let teammates ask why from Discord.</div></div><span class="pill">coming soon</span></div>' +
      '<div class="conn"><div class="ic" style="background:#4A154B">S</div><div><b>Slack</b><div class="note">Notify teammates in Slack when work is shared or handed to them.</div></div><span class="pill">coming soon</span></div>' +
    '</div><div class="row" style="margin-top:24px"><button class="btn" id="signout">Sign out</button></div>';
  $("#signout").onclick = async () => { await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }); location.href = "/"; };
}

// ---------- router ----------
let cleanup = () => {};
async function route() {
  cleanup(); cleanup = () => {};
  const h = location.hash.replace(/^#/, "") || "/";
  try {
    let m;
    if (h === "/" ) await worksView();
    else if (h === "/inbox") await inboxView();
    else if (h === "/projects") await projectsView();
    else if (h === "/settings") settingsView();
    else if ((m = h.match(/^\/w\/([\w-]+)$/))) await workView(m[1]);
    else if ((m = h.match(/^\/p\/([\w-]+)$/))) await projectView(m[1]);
    else location.hash = "#/";
  } catch (e) {
    view.innerHTML = '<div class="empty">' + (e.message === "not_found" ? "Not found, or you don't have access." : esc(e.message)) + "</div>";
  }
  scrollTo(0, 0);
}
addEventListener("hashchange", route);
route(); refreshUnread(); connectLive();
`;
