// The artifact page at /a/:id: view, edit together, share and hand over — one page for every kind.
// Live: an ArtifactRoom socket brings other people's and agents' edits in as they land, plus who is where.
// The Mac viewer (anydock open) loads this page with the CLI's token injected as window.__ANYDOCK_TOKEN.
export function artifactPage(opts: { id: string; me: { id: string; name: string; email: string }; origin: string }): string {
  const boot = JSON.stringify({ id: opts.id, me: opts.me, origin: opts.origin }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AnyDock</title>
<link rel="icon" href="/img/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked@18.1.1/lib/marked.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.17/dist/purify.min.js"></script>
<style>${CSS}</style></head>
<body>
<header class="top">
  <a class="home" href="/app#/artifacts" title="All artifacts"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>
  <span class="kind" id="kindIcon"></span>
  <div class="tt"><input id="title" spellcheck="false" aria-label="Title"><div class="prov" id="prov"></div></div>
  <div class="right">
    <div class="people" id="people"></div>
    <span class="live" id="live" title="Live">●</span>
    <div class="menu"><button class="btn" id="exportBtn">Export</button><div class="pop" id="exportPop" hidden></div></div>
    <button class="btn" id="historyBtn">History</button>
    <button class="btn primary" id="shareBtn">Share</button>
  </div>
</header>
<div class="sharepop" id="sharePop" hidden></div>
<main id="main"><div class="loading"><div class="sk w60"></div><div class="sk"></div><div class="sk w80"></div></div></main>
<aside class="drawer" id="drawer" hidden><div class="dh"><b>History</b><button class="x" id="closeDrawer">×</button></div><div id="events"></div></aside>
<div class="toast" id="toast" hidden></div>
<script>window.BOOT = ${boot};</script>
<script type="module">${CLIENT}</script>
</body></html>`;
}

const CSS = String.raw`
:root { --bg:#fafafa; --card:#fff; --text:#0a0a0b; --muted:#5d5d66; --faint:#a1a1aa; --line:rgba(10,10,12,.08); --line2:rgba(10,10,12,.14);
  --soft:#f4f4f5; --accent:#2b59ff; --accent-soft:#eef2ff; --ok:#15803d; --warn:#b45309; --red:#c2410c;
  --sans:Geist, ui-sans-serif, system-ui, sans-serif; --mono:"Geist Mono", ui-monospace, monospace; --serif:"Instrument Serif", Georgia, serif; }
* { box-sizing:border-box; }
html, body { margin:0; background:var(--bg); color:var(--text); font:15px/1.55 var(--sans); -webkit-font-smoothing:antialiased; }
button { font:inherit; } a { color:inherit; }
.top { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:10px; padding:10px 16px; background:rgba(255,255,255,.88); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); }
.home { display:grid; place-items:center; width:30px; height:30px; border-radius:8px; color:var(--muted); } .home:hover { background:var(--soft); color:var(--text); }
.kind { display:grid; place-items:center; width:30px; height:30px; border-radius:8px; background:var(--accent-soft); color:var(--accent); flex:none; }
.tt { min-width:0; flex:1; }
#title { width:100%; border:0; background:transparent; font:600 16px var(--sans); padding:2px 4px; border-radius:6px; color:var(--text); }
#title:hover { background:var(--soft); } #title:focus { outline:2px solid var(--accent-soft); background:#fff; }
.prov { font-size:12px; color:var(--muted); padding:0 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.prov a { color:var(--accent); text-decoration:none; } .prov a:hover { text-decoration:underline; }
.right { display:flex; align-items:center; gap:8px; flex:none; }
.btn { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:9px; border:1px solid var(--line2); background:#fff; color:var(--text); font-weight:500; font-size:13.5px; cursor:pointer; white-space:nowrap; text-decoration:none; }
.btn:hover { background:var(--soft); } .btn.primary { background:var(--text); color:#fff; border-color:var(--text); } .btn.primary:hover { background:#27272a; }
.btn.sm { padding:4px 9px; font-size:12.5px; border-radius:7px; } .btn.ghost { border-color:transparent; background:transparent; color:var(--muted); } .btn.ghost:hover { background:var(--soft); color:var(--text); }
.btn:disabled { opacity:.5; cursor:default; }
.live { color:var(--faint); font-size:10px; } .live.on { color:#22c55e; animation:breathe 2.4s ease-in-out infinite; }
@keyframes breathe { 50% { opacity:.35; } }
.people { display:flex; } .av { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; color:#fff; font:600 11.5px var(--sans); border:2px solid #fff; margin-left:-7px; position:relative; animation:pop .35s cubic-bezier(.2,.9,.3,1.3); }
.av .bot { position:absolute; right:-3px; bottom:-3px; width:14px; height:14px; border-radius:50%; background:#fff; color:var(--text); display:grid; place-items:center; font-size:9px; border:1px solid var(--line2); }
@keyframes pop { from { transform:scale(.4); opacity:0; } }
.menu { position:relative; }
.pop { position:absolute; right:0; top:calc(100% + 6px); background:#fff; border:1px solid var(--line2); border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,.1); padding:6px; min-width:220px; z-index:30; }
.pop button, .pop a { display:flex; width:100%; gap:8px; align-items:center; text-align:left; border:0; background:transparent; padding:8px 10px; border-radius:8px; cursor:pointer; font-size:13.5px; text-decoration:none; color:var(--text); }
.pop button:hover, .pop a:hover { background:var(--soft); } .pop small { color:var(--muted); margin-left:auto; }
.sharepop { position:fixed; right:16px; top:58px; z-index:40; width:400px; max-width:calc(100vw - 32px); background:#fff; border:1px solid var(--line2); border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,.14); padding:16px; animation:drop .2s ease-out; }
@keyframes drop { from { transform:translateY(-6px); opacity:0; } }
.sharepop h3 { margin:0 0 10px; font-size:15px; } .sharepop .row { display:flex; gap:6px; margin-bottom:10px; }
.sharepop input, .sharepop select, .sharepop textarea { font:inherit; font-size:13.5px; border:1px solid var(--line2); border-radius:9px; padding:7px 10px; background:#fff; }
.sharepop input { flex:1; min-width:0; } .sharepop textarea { width:100%; resize:vertical; min-height:54px; margin-bottom:8px; }
.who { display:flex; align-items:center; gap:9px; padding:7px 2px; border-top:1px solid var(--line); font-size:13.5px; } .who .m { color:var(--muted); font-size:12.5px; margin-left:auto; }
.who .ini { width:26px; height:26px; border-radius:50%; background:var(--soft); display:grid; place-items:center; font:600 11px var(--sans); color:var(--muted); }
.note { font-size:12.5px; color:var(--muted); margin:8px 0 0; } .sep { height:1px; background:var(--line); margin:12px 0; }
main { min-height:calc(100vh - 56px); }
.loading { max-width:760px; margin:60px auto; padding:0 24px; }
.sk { height:13px; border-radius:7px; margin:11px 0; background:linear-gradient(90deg, #eeeef0 0%, #f7f7f8 40%, #eeeef0 80%); background-size:300% 100%; animation:shimmer 1.6s linear infinite; }
.sk.w60 { width:60%; } .sk.w80 { width:80%; } .sk.w40 { width:40%; } .sk.w90 { width:90%; }
@keyframes shimmer { from { background-position:100% 0; } to { background-position:-100% 0; } }
.drawer { position:fixed; right:0; top:56px; bottom:0; width:340px; max-width:100vw; background:#fff; border-left:1px solid var(--line); z-index:15; overflow-y:auto; padding:14px 16px; animation:slide .22s ease-out; }
@keyframes slide { from { transform:translateX(30px); opacity:0; } }
.dh { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; } .x { border:0; background:transparent; font-size:20px; cursor:pointer; color:var(--muted); }
.ev { display:flex; gap:9px; padding:9px 0; border-bottom:1px solid var(--line); font-size:13px; } .ev .t { color:var(--faint); font-size:12px; white-space:nowrap; }
.ev .tag { font-size:11px; border:1px solid var(--line2); border-radius:99px; padding:0 6px; color:var(--muted); margin-left:4px; }
.toast { position:fixed; left:50%; bottom:22px; transform:translateX(-50%); background:var(--text); color:#fff; padding:9px 14px; border-radius:10px; font-size:13.5px; z-index:50; animation:drop .2s ease-out; }
.empty { max-width:520px; margin:80px auto; text-align:center; color:var(--muted); }

/* ---- doc ---- */
.docwrap { display:grid; grid-template-columns:240px minmax(0, 1fr); gap:0; }
.outline { position:sticky; top:56px; height:calc(100vh - 56px); overflow-y:auto; padding:22px 14px; border-right:1px solid var(--line); background:#fff; }
.outline .prog { font-size:12px; color:var(--muted); margin:0 6px 8px; display:flex; justify-content:space-between; }
.bar { height:4px; border-radius:99px; background:var(--soft); margin:0 6px 14px; overflow:hidden; } .bar i { display:block; height:100%; background:var(--accent); border-radius:99px; transition:width .6s cubic-bezier(.2,.8,.2,1); }
.oi { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; font-size:13px; color:var(--muted); cursor:pointer; text-decoration:none; }
.oi:hover { background:var(--soft); color:var(--text); } .oi.l1 { font-weight:600; color:var(--text); }
.dot { width:7px; height:7px; border-radius:50%; flex:none; background:#d4d4d8; } .dot.st-done { background:#22c55e; } .dot.st-writing { background:var(--accent); animation:breathe 1.2s infinite; }
.paper { max-width:780px; margin:0 auto; padding:44px 48px 140px; }
.sec { position:relative; border-radius:12px; padding:6px 14px 6px; margin:0 -14px 6px; transition:background .2s, box-shadow .2s; scroll-margin-top:80px; }
.sec:hover { background:#fff; box-shadow:0 0 0 1px var(--line); }
.sec .tools { position:absolute; right:8px; top:8px; display:none; gap:4px; } .sec:hover .tools { display:flex; }
.sec.locked { box-shadow:0 0 0 2px var(--lock, var(--accent)); background:#fff; }
.sec .lockby { position:absolute; left:12px; top:-10px; font:600 11px var(--sans); color:#fff; padding:1px 7px; border-radius:6px; background:var(--lock, var(--accent)); }
.sec h1, .sec h2 { margin:22px 0 8px; letter-spacing:-.015em; line-height:1.2; } .sec h1 { font-size:34px; font-weight:600; } .sec h2 { font-size:23px; font-weight:600; }
.prose { font-size:16px; line-height:1.7; color:#1f1f23; } .prose p { margin:0 0 14px; } .prose ul, .prose ol { padding-left:22px; margin:0 0 14px; }
.prose code { font:13.5px var(--mono); background:var(--soft); padding:1px 5px; border-radius:5px; } .prose pre { background:#0b0b0e; color:#e4e4e7; padding:14px 16px; border-radius:12px; overflow:auto; }
.prose pre code { background:transparent; color:inherit; padding:0; } .prose blockquote { margin:0 0 14px; padding:2px 16px; border-left:3px solid var(--line2); color:var(--muted); }
.prose table { border-collapse:collapse; margin:0 0 14px; font-size:14px; } .prose th, .prose td { border:1px solid var(--line2); padding:6px 10px; } .prose th { background:var(--soft); }
.prose h3 { font-size:18px; margin:18px 0 6px; } .prose img { max-width:100%; border-radius:10px; } .prose a { color:var(--accent); }
.todo { border:1px dashed var(--line2); border-radius:12px; padding:12px 16px 8px; background:repeating-linear-gradient(-45deg, transparent 0 10px, rgba(10,10,12,.012) 10px 20px); }
.todo .brief { font-size:13.5px; color:var(--muted); font-style:italic; margin:0 0 6px; } .todo .lbl { font:600 11px var(--sans); letter-spacing:.06em; text-transform:uppercase; color:var(--faint); }
.writing .lbl { color:var(--accent); }
.arrive { animation:reveal 1.1s cubic-bezier(.2,.8,.2,1) both; }
@keyframes reveal { from { clip-path:inset(0 0 100% 0); opacity:.2; filter:blur(2px); } to { clip-path:inset(0 0 0 0); opacity:1; filter:none; } }
.flash { animation:flash 2.2s ease-out; } @keyframes flash { 0% { box-shadow:0 0 0 2px var(--fc, var(--accent)); background:#fff; } 100% { box-shadow:0 0 0 0 transparent; } }
.by { font-size:11.5px; color:var(--faint); margin-top:-4px; }
.editor { margin:6px 0 10px; } .editor textarea { width:100%; min-height:160px; resize:vertical; border:1px solid var(--line2); border-radius:12px; padding:12px 14px; font:14px/1.6 var(--mono); background:#fff; color:var(--text); }
.editor textarea:focus { outline:3px solid var(--accent-soft); border-color:var(--accent); } .editor input.h { width:100%; border:0; border-bottom:1px solid var(--line2); font:600 22px var(--sans); padding:6px 2px; margin-bottom:8px; background:transparent; }
.editor .acts { display:flex; gap:6px; margin-top:8px; align-items:center; } .editor .hint { font-size:12px; color:var(--faint); margin-left:auto; }
.addsec { display:flex; align-items:center; gap:8px; margin:4px 0 4px; opacity:0; transition:opacity .15s; } .addsec:hover { opacity:1; } .addsec hr { flex:1; border:0; border-top:1px dashed var(--line2); }
.addsec button { border:1px solid var(--line2); background:#fff; border-radius:99px; font-size:12px; padding:2px 10px; cursor:pointer; color:var(--muted); }

/* ---- slides ---- */
.deck { display:grid; grid-template-columns:200px minmax(0,1fr); height:calc(100vh - 56px); }
.thumbs { overflow-y:auto; padding:16px 12px; border-right:1px solid var(--line); background:#fff; }
.thumb { position:relative; margin-bottom:12px; cursor:pointer; } .thumb .n { position:absolute; left:-2px; top:2px; font-size:11px; color:var(--faint); }
.thumb .sl { margin-left:14px; transform-origin:top left; }
.thumb.on .frame { box-shadow:0 0 0 2px var(--accent); }
.frame { aspect-ratio:16/9; background:#fff; border-radius:8px; box-shadow:0 0 0 1px var(--line2); overflow:hidden; position:relative; }
.stage { display:flex; flex-direction:column; align-items:center; padding:28px; overflow-y:auto; }
.stage .frame { width:min(100%, 1000px); border-radius:14px; box-shadow:0 1px 0 var(--line), 0 20px 60px rgba(0,0,0,.08); }
.slide { position:absolute; inset:0; padding:6% 7%; display:flex; flex-direction:column; container-type:size; }
.slide h2 { font-size:6.4cqh; margin:0 0 3cqh; letter-spacing:-.02em; line-height:1.1; }
.slide .prose { font-size:3.6cqh; line-height:1.45; } .slide .prose ul { padding-left:1.2em; } .slide .prose li { margin:.4em 0; }
.slide.title { justify-content:center; } .slide.title h2 { font-size:9cqh; } .slide.title .prose { color:var(--muted); font-size:4cqh; }
.slide .skel { margin-top:2cqh; } .slide .skel .sk { height:2.6cqh; margin:2.4cqh 0; }
.stagebar { width:min(100%, 1000px); display:flex; gap:8px; align-items:center; margin:14px 0; }
.stagebar .meta { font-size:12.5px; color:var(--muted); margin-right:auto; }
.present { position:fixed; inset:0; background:#000; z-index:100; display:grid; place-items:center; }
.present .frame { width:min(100vw, 177.7vh); border-radius:0; box-shadow:none; }
.present .pn { position:fixed; right:16px; bottom:12px; color:#777; font-size:13px; }

/* ---- sheet ---- */
.sheetbar { display:flex; align-items:center; gap:6px; padding:8px 14px; border-bottom:1px solid var(--line); background:#fff; position:sticky; top:56px; z-index:5; }
.tab { border:1px solid transparent; background:transparent; padding:5px 11px; border-radius:8px; font-size:13px; cursor:pointer; color:var(--muted); } .tab.on { background:var(--accent-soft); color:var(--accent); font-weight:600; }
.fx { display:flex; align-items:center; gap:8px; padding:6px 14px; border-bottom:1px solid var(--line); background:#fff; font:13px var(--mono); }
.fx .addr { width:64px; color:var(--muted); } .fx input { flex:1; border:0; font:13px var(--mono); padding:4px; outline:none; }
.gridwrap { overflow:auto; height:calc(100vh - 56px - 86px); background:#fff; }
table.grid { border-collapse:separate; border-spacing:0; font-size:13px; table-layout:fixed; }
.grid th { position:sticky; background:#f7f7f8; color:var(--muted); font-weight:500; font-size:12px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); z-index:2; user-select:none; }
.grid thead th { top:0; height:26px; } .grid tbody th { left:0; width:46px; text-align:center; } .grid thead th.corner { left:0; z-index:3; }
.grid td { height:28px; width:120px; max-width:120px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); padding:0 8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:cell; position:relative; }
.grid td.num { text-align:right; font-variant-numeric:tabular-nums; } .grid tr:first-child td { font-weight:600; }
.grid td.sel { box-shadow:inset 0 0 0 2px var(--accent); background:#f8faff; }
.grid td.peer { box-shadow:inset 0 0 0 2px var(--pc); } .grid td .ptag { position:absolute; right:0; top:-1px; font:600 9.5px var(--sans); color:#fff; background:var(--pc); padding:0 4px; border-radius:0 0 0 4px; }
.grid td.flash { animation:cellflash 1.6s ease-out; } @keyframes cellflash { 0% { background:color-mix(in srgb, var(--fc, var(--accent)) 25%, #fff); } 100% { background:#fff; } }
.cellin { position:absolute; z-index:6; border:2px solid var(--accent); font:13px var(--sans); padding:0 6px; outline:none; background:#fff; box-shadow:0 6px 20px rgba(0,0,0,.12); }

/* ---- source + preview (latex, html) ---- */
.split { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); height:calc(100vh - 56px); }
.split .src { border-right:1px solid var(--line); display:flex; flex-direction:column; background:#fff; min-width:0; }
.split .src textarea { flex:1; border:0; resize:none; padding:18px 20px; font:13.5px/1.65 var(--mono); outline:none; color:var(--text); background:#fff; tab-size:2; }
.split .pv { display:flex; flex-direction:column; min-width:0; background:var(--bg); }
.pvbar, .srcbar { display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid var(--line); font-size:12.5px; color:var(--muted); background:#fff; min-height:42px; }
.pvbar .sp, .srcbar .sp { margin-left:auto; }
.split iframe { flex:1; border:0; background:#fff; width:100%; }
.err { color:var(--red); font:12.5px var(--mono); padding:10px 14px; white-space:pre-wrap; }

/* ---- app / file ---- */
.appwrap { display:grid; grid-template-columns:minmax(0,1fr) 260px; height:calc(100vh - 56px); }
.appwrap iframe { width:100%; height:100%; border:0; background:#fff; }
.side { border-left:1px solid var(--line); background:#fff; padding:14px; overflow-y:auto; font-size:13px; }
.side h4 { font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); margin:14px 0 6px; } .side h4:first-child { margin-top:0; }
.fl { display:flex; justify-content:space-between; gap:8px; padding:5px 0; border-bottom:1px solid var(--line); font:12.5px var(--mono); } .fl span:last-child { color:var(--faint); }
.filev { max-width:1100px; margin:0 auto; padding:24px; }
.filebar { display:flex; align-items:center; gap:8px; margin-bottom:14px; flex-wrap:wrap; } .filebar .meta { color:var(--muted); font-size:13px; margin-right:auto; }
.filebox { background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; min-height:300px; }
.filebox iframe { width:100%; height:calc(100vh - 170px); border:0; display:block; }
.docx-host { background:#f0f0f2; padding:20px 0; max-height:calc(100vh - 170px); overflow:auto; } .docx-host .docx-wrapper { background:transparent !important; }
.pptx-host { display:flex; justify-content:center; padding:20px; background:#f0f0f2; }
.imgbox { display:grid; place-items:center; padding:20px; } .imgbox img { max-width:100%; max-height:calc(100vh - 220px); }
@media (max-width:860px) {
  .docwrap { grid-template-columns:1fr; } .outline { display:none; } .paper { padding:24px 18px 120px; }
  .deck { grid-template-columns:1fr; } .thumbs { display:none; } .split { grid-template-columns:1fr; grid-template-rows:1fr 1fr; } .appwrap { grid-template-columns:1fr; } .side { display:none; }
  .right .btn:not(.primary) { display:none; } .people { display:none; }
}
`;

// Browser code. Plain string concatenation only (no template literals): this whole block sits in a TS template.
const CLIENT = String.raw`
const B = window.BOOT;
const TOKEN = window.__ANYDOCK_TOKEN || null;
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const md = (t) => window.DOMPurify.sanitize(window.marked.parse(t || "", { gfm: true, breaks: false }));
const main = $("#main");
let A = null, ACCESS = "view", S = [], FILES = [], SHARES = [], EVENTS = [], WORK = null, OWNER = null, PEOPLE = [], ME_CONN = null;
const canEdit = () => ACCESS === "owner" || ACCESS === "edit";

async function api(method, path, body, raw) {
  const headers = {};
  if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
  if (body !== undefined && !raw) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { method, headers, credentials: "same-origin", body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || data.error || ("HTTP " + res.status)); e.status = res.status; e.data = data; throw e; }
  return data;
}
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }
function ago(ts) { const s = (Date.now() - new Date(ts).getTime()) / 1000; if (s < 50) return "just now"; if (s < 3600) return Math.round(s / 60) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago"; return new Date(ts).toLocaleDateString(); }
const initials = (n) => String(n || "?").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("");
function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
const safeName = () => (A.title || "artifact").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
const fileUrl = (p, v) => "/api/artifacts/" + A.id + "/files/" + p.split("/").map(encodeURIComponent).join("/") + (v ? "?v=" + v : "");
async function fileBlob(p) { const headers = TOKEN ? { Authorization: "Bearer " + TOKEN } : {}; const r = await fetch(fileUrl(p), { headers, credentials: "same-origin" }); if (!r.ok) throw new Error("Couldn't load " + p); return r.blob(); }
const colorOf = (id) => ["#2b59ff", "#e5484d", "#12a594", "#f76b15", "#8e4ec6", "#d6409f", "#0090ff", "#46a758"][[...String(id || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 8];

const ICON = {
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  slides: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  latex: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  html: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  app: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
};
const svg = (k, s) => '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICON[k] || ICON.file) + "</svg>";
const KIND_NAME = { doc: "Document", slides: "Slides", sheet: "Spreadsheet", latex: "LaTeX", html: "Web page", app: "App", file: "File" };

// ---------- load + header ----------

async function load() {
  const d = await api("GET", "/api/artifacts/" + B.id);
  A = d.artifact; ACCESS = A.access; S = d.sections; FILES = d.files; SHARES = d.shares; EVENTS = d.events; WORK = d.work; OWNER = d.owner;
  header();
}
function header() {
  document.title = A.title + " · AnyDock";
  $("#kindIcon").innerHTML = svg(A.kind === "file" ? "file" : A.kind, 16);
  const t = $("#title"); if (document.activeElement !== t) t.value = A.title; t.readOnly = !canEdit();
  const bits = [KIND_NAME[A.kind] + (A.kind === "file" ? " · ." + A.format : "")];
  if (OWNER) bits.push(esc(OWNER.name || OWNER.email));
  if (WORK) bits.push('from <a href="/app#/w/' + WORK.id + '">' + esc(WORK.title) + "</a> (" + esc(WORK.source === "codex" ? "Codex" : "Claude Code") + " session)");
  if (!canEdit()) bits.push("view only");
  $("#prov").innerHTML = bits.join(" · ");
}
$("#title").addEventListener("change", async (e) => { if (!canEdit()) return; const v = e.target.value.trim(); if (!v || v === A.title) return; A.title = v; await api("PATCH", "/api/artifacts/" + A.id, { title: v }).catch((x) => toast(x.message)); header(); });
$("#title").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

// ---------- live ----------

let ws;
function connect() {
  const url = location.origin.replace(/^http/, "ws") + "/api/artifacts/" + B.id + "/live" + (TOKEN ? "?token=" + encodeURIComponent(TOKEN) : "");
  ws = new WebSocket(url);
  ws.onopen = () => { $("#live").classList.add("on"); sendFocus(); };
  ws.onclose = () => { $("#live").classList.remove("on"); setTimeout(connect, 2000); };
  ws.onmessage = (m) => { let ev; try { ev = JSON.parse(m.data); } catch { return; } onEvent(ev); };
}
setInterval(() => ws && ws.readyState === 1 && ws.send("ping"), 25000);
let myFocus = null;
function focusOn(f) { myFocus = f; sendFocus(); }
function sendFocus() { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "focus", focus: myFocus })); }

function onEvent(ev) {
  if (ev.type === "hello") { ME_CONN = ev.you; return; }
  if (ev.type === "presence") { PEOPLE = ev.people; renderPeople(); VIEW.presence && VIEW.presence(); return; }
  if (ev.by && ev.type !== "section.lock") { EVENTS.unshift({ at: ev.at, actorName: ev.by.name, via: ev.by.via, kind: ev.type, detail: ev.section ? ev.section.heading : null }); if (!$("#drawer").hidden) renderEvents(); }
  if (ev.type === "renamed") { A.title = ev.title; header(); return; }
  if (ev.type === "shared" || ev.type === "handed_over" || ev.type === "share.revoked") { load().catch(() => {}); return; }
  VIEW.event && VIEW.event(ev);
}
function renderPeople() {
  const seen = new Set();
  const list = PEOPLE.filter((p) => { const k = p.userId + "|" + p.via; if (seen.has(k)) return false; seen.add(k); return true; });
  $("#people").innerHTML = list.map((p) => '<span class="av" style="background:' + p.color + '" title="' + esc(p.name + (p.via === "agent" ? " (agent)" : "") + (p.userId === B.me.id && p.via !== "agent" ? " · you" : "")) + '">' + esc(initials(p.name)) + (p.via === "agent" ? '<span class="bot">✦</span>' : "") + "</span>").join("");
}

// ---------- history ----------

$("#historyBtn").onclick = () => { const d = $("#drawer"); d.hidden = !d.hidden; if (!d.hidden) renderEvents(); };
$("#closeDrawer").onclick = () => ($("#drawer").hidden = true);
const EV_TEXT = { created: "created it", "section.updated": "edited", "section.added": "added a section", "section.deleted": "removed a section", "content.replaced": "rewrote it", "cells.updated": "edited", "sheet.replaced": "replaced a sheet", "version.uploaded": "uploaded", renamed: "renamed it", shared: "shared it with", handed_over: "handed it over to", "share.revoked": "removed access" };
function renderEvents() {
  $("#events").innerHTML = EVENTS.map((e) => '<div class="ev"><div style="flex:1"><b>' + esc(e.actorName || "Someone") + "</b>" + (e.via === "agent" ? '<span class="tag">agent</span>' : "") + " " + esc(EV_TEXT[e.kind] || e.kind) + (e.detail ? ' <span style="color:var(--muted)">' + esc(e.detail) + "</span>" : "") + '</div><span class="t">' + ago(e.at) + "</span></div>").join("") || '<p class="note">Nothing yet.</p>';
  if (A.kind === "file" || A.kind === "app") {
    api("GET", "/api/artifacts/" + A.id + "/versions").then(({ versions }) => {
      $("#events").insertAdjacentHTML("afterbegin", '<p class="note" style="margin:0 0 6px"><b>Versions</b></p>' + versions.map((v) => '<div class="ev"><div style="flex:1">v' + v.version + " · " + v.files + " file(s) · " + esc(v.by || "") + '</div><span class="t">' + ago(v.createdAt) + "</span></div>").join("") + '<div class="sep"></div>');
    }).catch(() => {});
  }
}

// ---------- share / hand over ----------

$("#shareBtn").onclick = () => { const p = $("#sharePop"); p.hidden = !p.hidden; if (!p.hidden) renderShare(); };
document.addEventListener("click", (e) => {
  if (!$("#sharePop").hidden && !e.target.closest("#sharePop") && !e.target.closest("#shareBtn")) $("#sharePop").hidden = true;
  if (!$("#exportPop").hidden && !e.target.closest(".menu")) $("#exportPop").hidden = true;
});
function renderShare() {
  const p = $("#sharePop");
  const owner = ACCESS === "owner";
  p.innerHTML = "<h3>Share “" + esc(A.title) + "”</h3>" +
    (canEdit() ? '<div class="row"><input id="shTo" type="email" placeholder="teammate@company.com"><select id="shRole"><option value="editor">Can edit</option><option value="viewer">Can view</option></select><button class="btn primary sm" id="shGo">Share</button></div>' : '<p class="note">You can view this. Ask the owner to share it further.</p>') +
    '<div class="who"><span class="ini">' + esc(initials(OWNER && (OWNER.name || OWNER.email))) + "</span>" + esc(OWNER ? OWNER.name || OWNER.email : "Owner") + '<span class="m">Owner</span></div>' +
    SHARES.map((s) => '<div class="who"><span class="ini">' + esc(initials(s.name || s.toEmail)) + "</span>" + esc(s.name || s.toEmail) + '<span class="m">' + (s.role === "editor" ? "Can edit" : "Can view") + (owner ? ' · <a href="#" data-unshare="' + s.id + '">remove</a>' : "") + "</span></div>").join("") +
    (WORK ? '<p class="note">Also visible to whoever can see its work, <a href="/app#/w/' + WORK.id + '">' + esc(WORK.title) + "</a>; a handover of that work moves it too.</p>" : "") +
    (owner ? '<div class="sep"></div><b style="font-size:13.5px">Hand over</b><p class="note" style="margin:2px 0 8px">They become the owner, with this artifact\'s full history; you keep edit access.</p><div class="row"><input id="hoTo" type="email" placeholder="who takes it over"></div><textarea id="hoNote" placeholder="Note for them (what\'s done, what\'s next)"></textarea><button class="btn sm" id="hoGo">Hand over</button>' : "") +
    '<div class="sep"></div><button class="btn sm ghost" id="copyLink">Copy link</button>';
  const go = $("#shGo"); if (go) go.onclick = async () => { const to = $("#shTo").value.trim(); if (!to) return; try { await api("POST", "/api/artifacts/" + A.id + "/share", { to, role: $("#shRole").value }); toast("Shared with " + to); await load(); renderShare(); } catch (e) { toast(e.message); } };
  const ho = $("#hoGo"); if (ho) ho.onclick = async () => { const to = $("#hoTo").value.trim(); if (!to) return; try { await api("POST", "/api/artifacts/" + A.id + "/handover", { to, note: $("#hoNote").value || undefined }); toast("Handed over to " + to); await load(); renderShare(); } catch (e) { toast(e.message); } };
  p.querySelectorAll("[data-unshare]").forEach((a) => (a.onclick = async (e) => { e.preventDefault(); await api("DELETE", "/api/artifacts/" + A.id + "/shares/" + a.dataset.unshare).catch((x) => toast(x.message)); await load(); renderShare(); }));
  $("#copyLink").onclick = () => { navigator.clipboard.writeText(location.origin + "/a/" + A.id); toast("Link copied"); };
}

// ---------- export menu ----------

$("#exportBtn").onclick = () => { const p = $("#exportPop"); p.hidden = !p.hidden; if (!p.hidden) p.innerHTML = (VIEW.exports ? VIEW.exports() : []).map((x, i) => '<button data-i="' + i + '">' + x[0] + "<small>" + x[1] + "</small></button>").join("") || '<p class="note" style="padding:6px 10px">Nothing to export.</p>'; p.querySelectorAll("[data-i]").forEach((b) => (b.onclick = async () => { p.hidden = true; try { await VIEW.exports()[b.dataset.i][2](); } catch (e) { toast(e.message); } })); };

// ---------- views ----------
let VIEW = {};

// Sectioned markdown shared by docs and decks.
function sectionMarkdown(list) { return list.map((s) => (s.heading ? "#".repeat(Math.min(Math.max(s.level, 1), 2)) + " " + s.heading + "\n\n" : "") + (s.body || "")).join("\n\n").trim() + "\n"; }
function upsertSection(sec) { const i = S.findIndex((x) => x.id === sec.id); if (i >= 0) S[i] = Object.assign({}, S[i], sec); else { S.push(sec); S.sort((a, b) => a.position - b.position); } }
async function lockSection(id, on) { return api("POST", "/api/artifacts/" + A.id + "/sections/" + id + "/lock", { on }); }

// ===== DOC =====
function docView() {
  let editing = null, renew = null;
  main.innerHTML = '<div class="docwrap"><nav class="outline" id="outline"></nav><div class="paper" id="paper"></div></div>';
  const lockColor = (s) => (s.lockedBy ? colorOf(s.lockedBy) : "");
  function outline() {
    const done = S.filter((s) => s.status === "done").length;
    $("#outline").innerHTML = '<div class="prog"><span>' + (S.length ? done + " of " + S.length + " written" : "Empty") + "</span><span>" + (S.length ? Math.round((done / S.length) * 100) : 0) + '%</span></div><div class="bar"><i style="width:' + (S.length ? (done / S.length) * 100 : 0) + '%"></i></div>' +
      S.map((s) => '<a class="oi ' + (s.level === 1 ? "l1" : "") + '" href="#s-' + s.id + '"><span class="dot st-' + s.status + '"></span>' + esc(s.heading || "Intro") + "</a>").join("");
  }
  function secHtml(s) {
    if (editing === s.id) return "";
    const locked = s.locked && s.lockedBy && s.lockedBy !== B.me.id;
    const head = s.heading ? (s.level === 1 ? "<h1>" : "<h2>") + esc(s.heading) + (s.level === 1 ? "</h1>" : "</h2>") : "";
    let body;
    if (s.status === "todo" || s.status === "writing") {
      body = '<div class="todo ' + s.status + '"><div class="lbl">' + (s.status === "writing" ? "✦ " + esc(s.updatedName || "Agent") + " is writing…" : "To write") + "</div>" + (s.brief ? '<p class="brief">' + esc(s.brief) + "</p>" : "") + '<div class="sk w90"></div><div class="sk w80"></div><div class="sk w60"></div></div>';
    } else body = '<div class="prose">' + md(s.body) + "</div>";
    const tools = canEdit() ? '<div class="tools"><button class="btn sm" data-edit="' + s.id + '">' + (s.status === "done" ? "Edit" : "Write") + '</button><button class="btn sm ghost" data-del="' + s.id + '" title="Remove section">×</button></div>' : "";
    return '<section class="sec' + (locked ? " locked" : "") + '" id="s-' + s.id + '" data-id="' + s.id + '" style="--lock:' + lockColor(s) + '">' + (locked ? '<span class="lockby">' + esc(s.lockedName) + " is editing</span>" : "") + tools + head + body + "</section>";
  }
  const addRow = (after) => canEdit() ? '<div class="addsec"><hr><button data-add="' + (after || "") + '">+ Section</button><hr></div>' : "";
  function render() {
    outline();
    if (!S.length) { $("#paper").innerHTML = '<div class="empty"><p>This document is empty.</p>' + (canEdit() ? '<button class="btn primary" data-add="">Add the first section</button>' : "") + "</div>"; bind(); return; }
    $("#paper").innerHTML = S.map((s) => (editing === s.id ? '<div id="s-' + s.id + '" class="sec" data-id="' + s.id + '">' + editorHtml(s) + "</div>" : secHtml(s)) + addRow(s.id)).join("");
    bind();
    if (editing) wireEditor();
  }
  function editorHtml(s) {
    return '<div class="editor"><input class="h" id="edHead" value="' + esc(s.heading) + '" placeholder="Section title"><textarea id="edBody" placeholder="Write in Markdown…">' + esc(s.body) + '</textarea><div class="acts"><button class="btn primary sm" id="edSave">Save</button><button class="btn sm" id="edCancel">Cancel</button><span class="hint">⌘↩ to save · Markdown</span></div></div>';
  }
  function bind() {
    $("#paper").querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => startEdit(b.dataset.edit)));
    $("#paper").querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => { if (!confirm("Remove this section?")) return; try { await api("DELETE", "/api/artifacts/" + A.id + "/sections/" + b.dataset.del); S = S.filter((x) => x.id !== b.dataset.del); render(); } catch (e) { toast(e.message); } }));
    $("#paper").querySelectorAll("[data-add]").forEach((b) => (b.onclick = async () => { try { const { section } = await api("POST", "/api/artifacts/" + A.id + "/sections", { heading: "New section", after: b.dataset.add || null, status: "todo" }); upsertSection(section); startEdit(section.id); } catch (e) { toast(e.message); } }));
    $("#paper").querySelectorAll("section.sec").forEach((el) => el.addEventListener("dblclick", () => canEdit() && startEdit(el.dataset.id)));
  }
  async function startEdit(id) {
    if (editing && editing !== id) await stopEdit(true);
    try { await lockSection(id, true); } catch (e) { toast(e.message); return; }
    editing = id; focusOn("sec:" + id); render();
    clearInterval(renew); renew = setInterval(() => lockSection(id, true).catch(() => {}), 30000);
    const ta = $("#edBody"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); grow(ta);
  }
  function grow(ta) { ta.style.height = "auto"; ta.style.height = Math.max(160, ta.scrollHeight + 4) + "px"; }
  function wireEditor() {
    const ta = $("#edBody"); ta.oninput = () => grow(ta);
    const save = async () => {
      const s = S.find((x) => x.id === editing); if (!s) return;
      try { const { section } = await api("PUT", "/api/artifacts/" + A.id + "/sections/" + s.id, { heading: $("#edHead").value, body: ta.value, status: ta.value.trim() ? "done" : "todo" }); upsertSection(section); } catch (e) { toast(e.message); return; }
      await stopEdit(false);
    };
    $("#edSave").onclick = save; $("#edCancel").onclick = () => stopEdit(false);
    [ta, $("#edHead")].forEach((el) => el.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); } if (e.key === "Escape") stopEdit(false); }));
  }
  async function stopEdit(silent) {
    const id = editing; editing = null; clearInterval(renew); focusOn(null);
    if (id) await lockSection(id, false).catch(() => {});
    const s = S.find((x) => x.id === id); if (s) { s.locked = false; s.lockedBy = null; }
    if (!silent) render();
  }
  function arrive(id, by) {
    const el = $("#s-" + id); if (!el) return;
    const body = el.querySelector(".prose, .todo"); if (body) body.classList.add("arrive");
    el.style.setProperty("--fc", by ? colorOf(by.id) : "var(--accent)"); el.classList.add("flash");
    if (by && by.via === "agent") el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  VIEW = {
    event(ev) {
      if (ev.type === "section.updated" || ev.type === "section.added") {
        const mine = ev.by && ev.by.id === B.me.id && ev.by.via !== "agent";
        upsertSection(ev.section);
        if (editing === ev.section.id) return;
        const el = $("#s-" + ev.section.id);
        if (el && editing) { el.outerHTML = secHtml(S.find((x) => x.id === ev.section.id)); outline(); bind(); }
        else render();
        if (!mine) arrive(ev.section.id, ev.by);
      } else if (ev.type === "section.deleted") { S = S.filter((x) => x.id !== ev.sectionId); if (editing !== ev.sectionId) render(); }
      else if (ev.type === "content.replaced") { S = ev.sections; editing = null; render(); S.forEach((s) => arrive(s.id, ev.by)); }
      else if (ev.type === "section.lock") {
        const s = S.find((x) => x.id === ev.sectionId); if (!s) return;
        s.locked = Boolean(ev.by); s.lockedBy = ev.by ? ev.by.id : null; s.lockedName = ev.by ? ev.by.name : null;
        if (editing !== s.id) { const el = $("#s-" + s.id); if (el) { el.outerHTML = secHtml(s); bind(); } }
      }
    },
    exports() {
      const html = () => "<h1>" + esc(A.title) + "</h1>" + S.map((s) => (s.heading ? (s.level === 1 ? "<h1>" : "<h2>") + esc(s.heading) + (s.level === 1 ? "</h1>" : "</h2>") : "") + md(s.body)).join("");
      return [
        ["Markdown", ".md", () => download(new Blob([sectionMarkdown(S)], { type: "text/markdown" }), safeName() + ".md")],
        ["Word", ".docx", async () => { toast("Building .docx…"); window.global = window; const m = await import("https://cdn.jsdelivr.net/npm/@turbodocx/html-to-docx@1.23.1/dist/html-to-docx.browser.esm.js"); const out = await m.default(html(), null, { title: A.title }); download(out instanceof Blob ? out : new Blob([out]), safeName() + ".docx"); }],
        ["PDF", "print", () => printHtml(html())],
        ["HTML", ".html", () => download(new Blob(["<!doctype html><meta charset=utf-8><title>" + esc(A.title) + "</title><body style='font:16px/1.65 system-ui;max-width:760px;margin:40px auto;padding:0 20px'>" + html()], { type: "text/html" }), safeName() + ".html")],
      ];
    },
  };
  render();
}
function printHtml(html) { const w = window.open("", "_blank"); w.document.write("<!doctype html><meta charset=utf-8><title>" + esc(A.title) + "</title><body style='font:15px/1.65 Georgia,serif;max-width:720px;margin:30px auto'>" + html + "<script>onload=()=>print()<\/script>"); w.document.close(); }

// ===== SLIDES =====
function slidesView() {
  let cur = 0, editing = null, renew = null;
  main.innerHTML = '<div class="deck"><nav class="thumbs" id="thumbs"></nav><div class="stage" id="stage"></div></div>';
  const slideInner = (s, i) => {
    const title = i === 0 && S.length > 1;
    if (s.status !== "done") return '<div class="slide"><h2>' + esc(s.heading || "Untitled") + '</h2><div class="skel"><div class="sk w80"></div><div class="sk w60"></div><div class="sk w70"></div>' + (s.brief ? '<p class="prose" style="color:var(--faint);font-style:italic">' + esc(s.brief) + "</p>" : "") + "</div></div>";
    return '<div class="slide' + (title ? " title" : "") + '"><h2>' + esc(s.heading) + '</h2><div class="prose">' + md(s.body) + "</div></div>";
  };
  function thumbs() {
    $("#thumbs").innerHTML = S.map((s, i) => '<div class="thumb' + (i === cur ? " on" : "") + '" data-i="' + i + '"><span class="n">' + (i + 1) + '</span><div class="frame" style="margin-left:14px">' + slideInner(s, i) + "</div></div>").join("") +
      (canEdit() ? '<button class="btn sm" id="addSlide" style="margin-left:14px">+ Slide</button>' : "");
    $("#thumbs").querySelectorAll(".thumb").forEach((t) => (t.onclick = () => { if (editing) return; cur = +t.dataset.i; render(); }));
    const add = $("#addSlide"); if (add) add.onclick = async () => { const after = S[S.length - 1]; const { section } = await api("POST", "/api/artifacts/" + A.id + "/sections", { heading: "New slide", after: after ? after.id : null, status: "todo" }); upsertSection(section); cur = S.findIndex((x) => x.id === section.id); startEdit(section.id); };
  }
  function stage() {
    const s = S[cur];
    if (!s) { $("#stage").innerHTML = '<div class="empty"><p>No slides yet.</p></div>'; return; }
    const locked = s.locked && s.lockedBy && s.lockedBy !== B.me.id;
    $("#stage").innerHTML = '<div class="frame" id="big">' + slideInner(s, cur) + '</div><div class="stagebar"><span class="meta">Slide ' + (cur + 1) + " of " + S.length + (locked ? " · <b style='color:" + colorOf(s.lockedBy) + "'>" + esc(s.lockedName) + " is editing</b>" : s.updatedName ? " · last edit " + esc(s.updatedName) + " " + ago(s.updatedAt) : "") + "</span>" +
      (canEdit() && !editing ? '<button class="btn sm" id="editSlide">Edit slide</button>' : "") + '<button class="btn sm" id="presentBtn">▶ Present</button></div>' +
      (editing === s.id ? '<div class="editor" style="width:min(100%,1000px)"><input class="h" id="edHead" value="' + esc(s.heading) + '"><textarea id="edBody" placeholder="- Bullet points in Markdown">' + esc(s.body) + '</textarea><div class="acts"><button class="btn primary sm" id="edSave">Save</button><button class="btn sm" id="edCancel">Cancel</button><span class="hint">Live preview above · ⌘↩ to save</span></div></div>' : "");
    const e = $("#editSlide"); if (e) e.onclick = () => startEdit(s.id);
    $("#presentBtn").onclick = present;
    if (editing === s.id) {
      const ta = $("#edBody"), hd = $("#edHead");
      const preview = () => { $("#big").innerHTML = slideInner(Object.assign({}, s, { heading: hd.value, body: ta.value, status: "done" }), cur); };
      ta.oninput = preview; hd.oninput = preview; ta.focus();
      const save = async () => { try { const { section } = await api("PUT", "/api/artifacts/" + A.id + "/sections/" + s.id, { heading: hd.value, body: ta.value, status: ta.value.trim() ? "done" : "todo" }); upsertSection(section); } catch (x) { toast(x.message); return; } stopEdit(); };
      $("#edSave").onclick = save; $("#edCancel").onclick = stopEdit;
      [ta, hd].forEach((el) => el.addEventListener("keydown", (k) => { if (k.key === "Enter" && (k.metaKey || k.ctrlKey)) { k.preventDefault(); save(); } if (k.key === "Escape") stopEdit(); }));
    }
  }
  async function startEdit(id) { try { await lockSection(id, true); } catch (e) { toast(e.message); return; } editing = id; focusOn("sec:" + id); clearInterval(renew); renew = setInterval(() => lockSection(id, true).catch(() => {}), 30000); render(); }
  async function stopEdit() { const id = editing; editing = null; clearInterval(renew); focusOn(null); if (id) await lockSection(id, false).catch(() => {}); render(); }
  function render() { thumbs(); stage(); }
  function present() {
    let i = cur;
    const ov = document.createElement("div"); ov.className = "present";
    const draw = () => { ov.innerHTML = '<div class="frame">' + slideInner(S[i], i) + '</div><span class="pn">' + (i + 1) + " / " + S.length + "</span>"; };
    draw(); document.body.appendChild(ov); ov.requestFullscreen && ov.requestFullscreen().catch(() => {});
    const key = (e) => { if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) { i = Math.min(S.length - 1, i + 1); draw(); } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { i = Math.max(0, i - 1); draw(); } else if (e.key === "Escape") close(); };
    const close = () => { document.removeEventListener("keydown", key); ov.remove(); document.fullscreenElement && document.exitFullscreen().catch(() => {}); };
    ov.onclick = () => { i = Math.min(S.length - 1, i + 1); draw(); };
    document.addEventListener("keydown", key);
  }
  document.addEventListener("keydown", (e) => { if (editing || document.querySelector(".present") || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; if (e.key === "ArrowDown" || e.key === "ArrowRight") { cur = Math.min(S.length - 1, cur + 1); render(); } if (e.key === "ArrowUp" || e.key === "ArrowLeft") { cur = Math.max(0, cur - 1); render(); } });
  VIEW = {
    event(ev) {
      if (ev.type === "section.updated" || ev.type === "section.added") { upsertSection(ev.section); if (editing === ev.section.id) return; if (ev.by && ev.by.via === "agent") cur = S.findIndex((x) => x.id === ev.section.id); render(); const big = $("#big"); if (big && S[cur] && S[cur].id === ev.section.id) { big.querySelector(".slide").classList.add("arrive"); } }
      else if (ev.type === "section.deleted") { S = S.filter((x) => x.id !== ev.sectionId); cur = Math.min(cur, S.length - 1); render(); }
      else if (ev.type === "content.replaced") { S = ev.sections; cur = 0; render(); }
      else if (ev.type === "section.lock") { const s = S.find((x) => x.id === ev.sectionId); if (s) { s.locked = Boolean(ev.by); s.lockedBy = ev.by ? ev.by.id : null; s.lockedName = ev.by ? ev.by.name : null; if (!editing) render(); } }
    },
    exports() {
      return [
        ["PowerPoint", ".pptx", async () => {
          toast("Building .pptx…");
          const PptxGenJS = (await import("https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/+esm")).default;
          const pptx = new PptxGenJS(); pptx.layout = "LAYOUT_WIDE"; pptx.title = A.title;
          S.forEach((s, i) => {
            const sl = pptx.addSlide();
            const lines = String(s.body || "").split("\n").map((l) => l.trim()).filter(Boolean);
            const runs = lines.map((l) => { const b = /^[-*+]\s+/.test(l) || /^\d+[.)]\s+/.test(l); return { text: l.replace(/^([-*+]|\d+[.)])\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/[*_\x60]/g, ""), options: { bullet: b, breakLine: true } }; });
            if (i === 0 && S.length > 1) { sl.addText(s.heading, { x: 0.8, y: 2.4, w: 11.7, h: 1.2, fontSize: 40, bold: true, fontFace: "Helvetica" }); if (runs.length) sl.addText(runs, { x: 0.8, y: 3.7, w: 11.7, h: 1.5, fontSize: 20, color: "5D5D66", fontFace: "Helvetica" }); }
            else { sl.addText(s.heading, { x: 0.7, y: 0.45, w: 12, h: 0.9, fontSize: 30, bold: true, fontFace: "Helvetica" }); if (runs.length) sl.addText(runs, { x: 0.7, y: 1.5, w: 12, h: 5.4, fontSize: 18, valign: "top", fontFace: "Helvetica", paraSpaceAfter: 6 }); }
          });
          const blob = await pptx.write({ outputType: "blob" }); download(blob, safeName() + ".pptx");
        }],
        ["Markdown", ".md", () => download(new Blob([sectionMarkdown(S)], { type: "text/markdown" }), safeName() + ".md")],
        ["PDF", "print", () => printHtml(S.map((s) => "<section style='page-break-after:always;padding:40px 0'><h1>" + esc(s.heading) + "</h1>" + md(s.body) + "</section>").join(""))],
      ];
    },
  };
  render();
}

// ===== SHEET =====
function sheetView() {
  let tab = 0, sel = { r: 0, c: 0 }, editingCell = null, pending = [], flushT = null;
  const rowsOf = (s) => { try { return JSON.parse(s.body || "[]"); } catch { return []; } };
  let DATA = S.map(rowsOf);
  const colName = (c) => { let s = ""; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  const ref = (r, c) => colName(c) + (r + 1);
  main.innerHTML = '<div class="sheetbar" id="tabs"></div><div class="fx"><span class="addr" id="addr">A1</span><input id="fxIn" spellcheck="false"' + (canEdit() ? "" : " readonly") + '></div><div class="gridwrap" id="gw"></div>';
  const raw = (r, c) => { const row = DATA[tab][r]; return row && row[c] != null ? row[c] : ""; };
  function parseRef(s) { const m = /^([A-Z]+)(\d+)$/.exec(s); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64); return { r: +m[2] - 1, c: c - 1 }; }
  function val(r, c, depth) {
    const v = raw(r, c);
    if (typeof v === "string" && v.startsWith("=")) return calc(v.slice(1), (depth || 0) + 1);
    if (v === "" || v == null) return "";
    const n = Number(v); return v !== "" && !isNaN(n) && typeof v !== "boolean" ? n : v;
  }
  function range(a, b, depth) { const p = parseRef(a), q = parseRef(b); if (!p || !q) return []; const out = []; for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) out.push(val(r, c, depth)); return out; }
  function calc(expr, depth) {
    if (depth > 30) return "#CYCLE";
    try {
      const nums = (xs) => xs.filter((x) => typeof x === "number");
      let e = expr.toUpperCase().replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([A-Z]+\d+):([A-Z]+\d+)\)/g, (_, f, a, b) => {
        const xs = nums(range(a, b, depth));
        if (f === "SUM") return String(xs.reduce((x, y) => x + y, 0));
        if (f === "AVERAGE" || f === "AVG") return String(xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
        if (f === "MIN") return String(xs.length ? Math.min.apply(null, xs) : 0);
        if (f === "MAX") return String(xs.length ? Math.max.apply(null, xs) : 0);
        return String(xs.length);
      });
      e = e.replace(/\b([A-Z]+\d+)\b/g, (m) => { const p = parseRef(m); const v = p ? val(p.r, p.c, depth) : 0; return typeof v === "number" ? "(" + v + ")" : v === "" ? "0" : "NaN"; });
      if (!/^[\d+\-*/().\s eE]*$/.test(e)) return "#ERR";
      const r = Function("return (" + e + ")")();
      return typeof r === "number" && isFinite(r) ? Math.round(r * 1e10) / 1e10 : "#ERR";
    } catch { return "#ERR"; }
  }
  function dims() { const d = DATA[tab] || []; const cols = Math.max(8, ...d.map((r) => r.length)) + 3; return { rows: Math.max(40, d.length + 15), cols }; }
  function tabs() {
    $("#tabs").innerHTML = S.map((s, i) => '<button class="tab' + (i === tab ? " on" : "") + '" data-t="' + i + '">' + esc(s.heading) + "</button>").join("") + (canEdit() ? '<button class="tab" id="addTab">+</button><span style="flex:1"></span><label class="btn sm">Import .xlsx / .csv<input type="file" id="imp" accept=".xlsx,.xls,.csv,.tsv" hidden></label>' : "");
    $("#tabs").querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tab = +b.dataset.t; sel = { r: 0, c: 0 }; grid(); tabs(); }));
    const add = $("#addTab"); if (add) add.onclick = async () => { await api("PUT", "/api/artifacts/" + A.id + "/sheet/new", { rows: [[""]], name: "Sheet" + (S.length + 1) }); await reload(); tab = S.length - 1; grid(); tabs(); };
    const imp = $("#imp"); if (imp) imp.onchange = () => importFile(imp.files[0]);
  }
  function cellHtml(r, c) {
    const v = val(r, c);
    const isNum = typeof v === "number";
    const shown = isNum ? v.toLocaleString(undefined, { maximumFractionDigits: 10 }) : v;
    return '<td data-r="' + r + '" data-c="' + c + '" class="' + (isNum ? "num" : "") + (r === sel.r && c === sel.c ? " sel" : "") + '">' + esc(shown) + "</td>";
  }
  function grid() {
    const { rows, cols } = dims();
    let h = '<table class="grid"><thead><tr><th class="corner"></th>';
    for (let c = 0; c < cols; c++) h += "<th>" + colName(c) + "</th>";
    h += "</tr></thead><tbody>";
    for (let r = 0; r < rows; r++) { h += "<tr><th>" + (r + 1) + "</th>"; for (let c = 0; c < cols; c++) h += cellHtml(r, c); h += "</tr>"; }
    $("#gw").innerHTML = h + "</tbody></table>";
    peers(); fx();
  }
  const td = (r, c) => $("#gw").querySelector('td[data-r="' + r + '"][data-c="' + c + '"]');
  function refreshCell(r, c) { const el = td(r, c); if (el) el.outerHTML = cellHtml(r, c); }
  function refreshAll() { $("#gw").querySelectorAll("td").forEach((el) => { const r = +el.dataset.r, c = +el.dataset.c; const v = val(r, c); const isNum = typeof v === "number"; el.textContent = isNum ? v.toLocaleString(undefined, { maximumFractionDigits: 10 }) : v; el.classList.toggle("num", isNum); }); peers(); }
  function fx() { $("#addr").textContent = ref(sel.r, sel.c); const f = $("#fxIn"); if (document.activeElement !== f) f.value = raw(sel.r, sel.c); }
  function select(r, c) {
    const old = td(sel.r, sel.c); if (old) old.classList.remove("sel");
    sel = { r: Math.max(0, r), c: Math.max(0, c) };
    const el = td(sel.r, sel.c); if (el) { el.classList.add("sel"); el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    fx(); focusOn("cell:" + S[tab].id + ":" + sel.r + ":" + sel.c);
  }
  function setCell(r, c, v, local) {
    const d = DATA[tab]; while (d.length <= r) d.push([]); while (d[r].length <= c) d[r].push(""); d[r][c] = v;
    if (local) { pending.push({ r, c, v }); clearTimeout(flushT); flushT = setTimeout(flush, 150); }
  }
  async function flush() { if (!pending.length) return; const cells = pending; pending = []; const sid = S[tab].id; try { await api("POST", "/api/artifacts/" + A.id + "/sheet/" + sid + "/cells", { cells }); } catch (e) { toast(e.message); } }
  function startCellEdit(initial) {
    if (!canEdit()) return;
    const el = td(sel.r, sel.c); if (!el) return;
    const rect = el.getBoundingClientRect(), wrap = $("#gw").getBoundingClientRect();
    const inp = document.createElement("input"); inp.className = "cellin";
    inp.style.left = rect.left - wrap.left + $("#gw").scrollLeft + "px"; inp.style.top = rect.top - wrap.top + $("#gw").scrollTop + "px";
    inp.style.width = Math.max(rect.width, 160) + "px"; inp.style.height = rect.height + "px";
    inp.value = initial != null ? initial : raw(sel.r, sel.c);
    $("#gw").style.position = "relative"; $("#gw").appendChild(inp); inp.focus();
    editingCell = inp;
    const done = (move) => { if (editingCell !== inp) return; editingCell = null; const v = inp.value; inp.remove(); if (v !== String(raw(sel.r, sel.c))) { setCell(sel.r, sel.c, v, true); refreshAll(); } if (move) select(sel.r + move[0], sel.c + move[1]); };
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); done([1, 0]); } else if (e.key === "Tab") { e.preventDefault(); done([0, e.shiftKey ? -1 : 1]); } else if (e.key === "Escape") { editingCell = null; inp.remove(); } };
    inp.onblur = () => done(null);
  }
  $("#gw").addEventListener("mousedown", (e) => { const el = e.target.closest("td"); if (!el) return; if (editingCell) editingCell.blur(); select(+el.dataset.r, +el.dataset.c); });
  $("#gw").addEventListener("dblclick", (e) => { if (e.target.closest("td")) startCellEdit(); });
  document.addEventListener("keydown", (e) => {
    if (editingCell || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const k = e.key;
    if (k === "ArrowDown") { e.preventDefault(); select(sel.r + 1, sel.c); } else if (k === "ArrowUp") { e.preventDefault(); select(sel.r - 1, sel.c); }
    else if (k === "ArrowRight" || k === "Tab") { e.preventDefault(); select(sel.r, sel.c + (e.shiftKey && k === "Tab" ? -1 : 1)); } else if (k === "ArrowLeft") { e.preventDefault(); select(sel.r, sel.c - 1); }
    else if (k === "Enter") { e.preventDefault(); startCellEdit(); }
    else if ((k === "Backspace" || k === "Delete") && canEdit()) { setCell(sel.r, sel.c, "", true); refreshAll(); fx(); }
    else if ((e.metaKey || e.ctrlKey) && k === "c") { navigator.clipboard.writeText(String(val(sel.r, sel.c))); }
    else if (k.length === 1 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); startCellEdit(k); }
  });
  document.addEventListener("paste", (e) => {
    if (editingCell || /INPUT|TEXTAREA/.test(document.activeElement.tagName) || !canEdit()) return;
    const text = e.clipboardData.getData("text/plain"); if (!text) return; e.preventDefault();
    text.replace(/\r/g, "").replace(/\n$/, "").split("\n").forEach((line, i) => line.split("\t").forEach((v, j) => setCell(sel.r + i, sel.c + j, v, true)));
    grid();
  });
  $("#fxIn").addEventListener("keydown", (e) => { if (e.key === "Enter") { setCell(sel.r, sel.c, e.target.value, true); refreshAll(); e.target.blur(); select(sel.r + 1, sel.c); } });
  function peers() {
    $("#gw").querySelectorAll("td.peer").forEach((el) => { el.classList.remove("peer"); const t = el.querySelector(".ptag"); if (t) t.remove(); });
    PEOPLE.forEach((p) => { if (p.conn === ME_CONN || !p.focus || !p.focus.startsWith("cell:" + (S[tab] && S[tab].id) + ":")) return; const [, , r, c] = p.focus.split(":"); const el = td(+r, +c); if (el) { el.classList.add("peer"); el.style.setProperty("--pc", p.color); el.insertAdjacentHTML("beforeend", '<span class="ptag">' + esc(p.name.split(" ")[0]) + "</span>"); } });
  }
  async function reload() { const d = await api("GET", "/api/artifacts/" + A.id); S = d.sections; DATA = S.map(rowsOf); }
  async function importFile(f) {
    if (!f) return;
    toast("Importing " + f.name + "…");
    const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
      const existing = S.find((s) => s.heading === name) || (S.length === 1 && DATA[0].every((r) => r.every((v) => v === "")) ? S[0] : null);
      await api("PUT", "/api/artifacts/" + A.id + "/sheet/" + (existing ? existing.id : "new"), { rows, name });
    }
    await reload(); tab = 0; tabs(); grid(); toast("Imported " + wb.SheetNames.length + " sheet(s)");
  }
  VIEW = {
    presence: peers,
    event(ev) {
      if (ev.type === "cells.updated") {
        const i = S.findIndex((s) => s.id === ev.sectionId); if (i < 0) return;
        if (ev.by && ev.by.id === B.me.id && ev.by.via !== "agent") return;
        const save = tab; tab = i; ev.cells.forEach((x) => setCell(x.r, x.c, x.v, false)); tab = save;
        if (i === tab) { refreshAll(); ev.cells.forEach((x) => { const el = td(x.r, x.c); if (el) { el.style.setProperty("--fc", colorOf(ev.by && ev.by.id)); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); } }); fx(); }
      } else if (ev.type === "sheet.replaced") { reload().then(() => { tabs(); grid(); }); }
    },
    exports() {
      const book = async (type) => { const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm"); const wb = XLSX.utils.book_new(); S.forEach((s, i) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(DATA[i].map((r) => r.map((v) => (typeof v === "string" && v.startsWith("=") ? { f: v.slice(1) } : v)))), s.heading.slice(0, 31) || "Sheet" + (i + 1))); return XLSX.write(wb, { bookType: type, type: "array" }); };
      return [
        ["Excel", ".xlsx", async () => download(new Blob([await book("xlsx")], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), safeName() + ".xlsx")],
        ["CSV", ".csv (this tab)", () => download(new Blob([DATA[tab].map((r, ri) => r.map((_, ci) => { const s = String(val(ri, ci)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n")], { type: "text/csv" }), safeName() + ".csv")],
      ];
    },
  };
  tabs(); grid(); select(0, 0);
}

// ===== LATEX / HTML: source + live preview =====
function sourceView() {
  const isTex = A.kind === "latex";
  const s = S[0] || { id: null, body: "" };
  let locked = false, saveT = null, renew = null;
  const pdf = FILES.find((f) => /\.pdf$/i.test(f.path));
  main.innerHTML = '<div class="split"><div class="src"><div class="srcbar"><b>' + esc(s.heading || (isTex ? "main.tex" : "index.html")) + '</b><span id="srcState">' + (canEdit() ? "Click to edit — saves as you type" : "View only") + '</span><span class="sp"></span></div><textarea id="src" spellcheck="false"' + (canEdit() ? "" : " readonly") + ">" + esc(s.body) + '</textarea></div><div class="pv"><div class="pvbar"><b>Preview</b>' +
    (isTex && pdf ? '<button class="btn sm" id="pdfBtn">Compiled PDF</button>' : "") + (A.appUrl ? '<a class="btn sm" target="_blank" href="' + A.appUrl + '">Open ↗</a>' : "") + '<span class="sp" id="pvState"></span></div><div class="err" id="err" hidden></div><iframe id="pv" ' + (isTex ? "" : 'sandbox="allow-scripts allow-forms allow-modals allow-popups"') + "></iframe></div></div>";
  const ta = $("#src");
  async function renderPreview() {
    const src = ta.value;
    if (!isTex) { $("#pv").srcdoc = src; return; }
    try {
      if (!window.latexjs) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/latex.js"; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
      const gen = new window.latexjs.HtmlGenerator({ hyphenate: false });
      const doc = window.latexjs.parse(src, { generator: gen }).htmlDocument("https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/");
      $("#pv").srcdoc = "<!doctype html>" + doc.documentElement.outerHTML; $("#err").hidden = true;
    } catch (e) { const er = $("#err"); er.hidden = false; er.textContent = "LaTeX: " + (e.message || e); }
  }
  let pvT; ta.addEventListener("input", () => { clearTimeout(pvT); pvT = setTimeout(renderPreview, isTex ? 500 : 250); });
  ta.addEventListener("focus", async () => {
    if (!canEdit() || locked || !s.id) return;
    try { await lockSection(s.id, true); locked = true; focusOn("sec:" + s.id); $("#srcState").textContent = "Editing — saves as you type"; renew = setInterval(() => lockSection(s.id, true).catch(() => {}), 30000); }
    catch (e) { toast(e.message); ta.blur(); }
  });
  ta.addEventListener("input", () => { if (!locked) return; $("#srcState").textContent = "Saving…"; clearTimeout(saveT); saveT = setTimeout(async () => { try { await api("PUT", "/api/artifacts/" + A.id + "/sections/" + s.id, { body: ta.value, status: "done" }); $("#srcState").textContent = "Saved"; } catch (e) { $("#srcState").textContent = e.message; } }, 700); });
  ta.addEventListener("blur", () => setTimeout(async () => { if (document.activeElement === ta || !locked) return; clearTimeout(saveT); await api("PUT", "/api/artifacts/" + A.id + "/sections/" + s.id, { body: ta.value, status: "done" }).catch(() => {}); locked = false; clearInterval(renew); await lockSection(s.id, false).catch(() => {}); focusOn(null); $("#srcState").textContent = "Click to edit — saves as you type"; }, 150));
  ta.addEventListener("keydown", (e) => { if (e.key === "Tab") { e.preventDefault(); const p = ta.selectionStart; ta.setRangeText("  ", p, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); } });
  const pb = $("#pdfBtn"); if (pb) pb.onclick = async () => { const url = URL.createObjectURL(await fileBlob(pdf.path)); $("#pv").removeAttribute("srcdoc"); $("#pv").src = url; };
  VIEW = {
    event(ev) {
      if ((ev.type === "section.updated" || ev.type === "content.replaced") && !(ev.by && ev.by.id === B.me.id && ev.by.via !== "agent")) {
        const sec = ev.section || (ev.sections && ev.sections[0]); if (!sec) return;
        if (!locked) { ta.value = sec.body; renderPreview(); $("#srcState").textContent = "Updated by " + ev.by.name; }
      } else if (ev.type === "section.lock" && ev.sectionId === s.id) {
        const other = ev.by && !(ev.by.id === B.me.id && ev.by.via !== "agent");
        ta.readOnly = !canEdit() || Boolean(other); $("#srcState").textContent = other ? ev.by.name + " is editing" : canEdit() ? "Click to edit — saves as you type" : "View only";
      } else if (ev.type === "version.uploaded") load().then(() => sourceView());
    },
    exports() {
      return isTex
        ? [["LaTeX source", ".tex", () => download(new Blob([ta.value], { type: "text/x-tex" }), safeName() + ".tex")]].concat(pdf ? [["Compiled PDF", ".pdf", async () => download(await fileBlob(pdf.path), safeName() + ".pdf")]] : []).concat([["Rendered PDF", "print", () => { const w = $("#pv").contentWindow; w && w.print(); }]])
        : [["HTML file", ".html", () => download(new Blob([ta.value], { type: "text/html" }), safeName() + ".html")]];
    },
  };
  renderPreview();
}

// ===== APP =====
function appView() {
  main.innerHTML = '<div class="appwrap"><iframe id="app" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads" src="' + A.appUrl + '"></iframe><div class="side"><h4>Running</h4><p class="note" style="margin:0 0 8px">Runs on its own origin: it can\'t see AnyDock or your accounts.</p><div style="display:flex;gap:6px"><a class="btn sm" target="_blank" href="' + A.appUrl + '">Open ↗</a><button class="btn sm" id="reloadApp">Reload</button></div><h4>Files · v' + A.version + "</h4>" +
    (FILES.length ? FILES.map((f) => '<div class="fl"><span>' + esc(f.path) + "</span><span>" + (f.size > 1024 ? Math.round(f.size / 1024) + " KB" : f.size + " B") + "</span></div>").join("") : '<p class="note">No files yet. Your agent uploads the app with <code>anydock_artifact_upload</code>.</p>') + "</div></div>";
  $("#reloadApp").onclick = () => ($("#app").src = A.appUrl + "?t=" + Date.now());
  VIEW = { event(ev) { if (ev.type === "version.uploaded") load().then(() => { appView(); toast("New version " + A.version + " from " + ev.by.name); }); }, exports() { return FILES.map((f) => [f.path, "download", async () => download(await fileBlob(f.path), f.path.split("/").pop())]); } };
}

// ===== FILE (Word, PowerPoint, Excel, PDF, images, anything) =====
async function fileView() {
  const f = FILES[0];
  const ext = f ? f.path.split(".").pop().toLowerCase() : A.format;
  const convert = { docx: ["doc", "Edit as a live document"], pptx: ["slides", "Edit as live slides"], xlsx: ["sheet", "Edit as a live sheet"], xls: ["sheet", "Edit as a live sheet"], csv: ["sheet", "Edit as a live sheet"], md: ["doc", "Edit as a live document"] }[ext];
  main.innerHTML = '<div class="filev"><div class="filebar"><span class="meta">' + (f ? esc(f.path) + " · " + (f.size > 1048576 ? (f.size / 1048576).toFixed(1) + " MB" : Math.round(f.size / 1024) + " KB") + " · version " + A.version : "No file uploaded yet") + "</span>" +
    (f ? '<button class="btn sm" id="dl">Download</button>' : "") + (f && convert && canEdit() ? '<button class="btn sm primary" id="conv">' + convert[1] + "</button>" : "") + '</div><div class="filebox" id="fb"><div class="loading"><div class="sk w60"></div><div class="sk"></div><div class="sk w80"></div></div></div></div>';
  VIEW = { event(ev) { if (ev.type === "version.uploaded") load().then(() => { fileView(); toast("New version from " + ev.by.name); }); }, exports() { return f ? [["Original", "." + ext, async () => download(await fileBlob(f.path), f.path.split("/").pop())]] : []; } };
  if (!f) { $("#fb").innerHTML = '<div class="empty"><p>Nothing here yet.</p></div>'; return; }
  $("#dl").onclick = async () => download(await fileBlob(f.path), f.path.split("/").pop());
  const fb = $("#fb");
  try {
    const blob = await fileBlob(f.path);
    if (ext === "pdf") fb.innerHTML = '<iframe src="' + URL.createObjectURL(new Blob([blob], { type: "application/pdf" })) + '"></iframe>';
    else if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext)) fb.innerHTML = '<div class="imgbox"><img src="' + URL.createObjectURL(blob) + '"></div>';
    else if (ext === "docx") { const m = await import("https://cdn.jsdelivr.net/npm/docx-preview@0.4.1/+esm"); fb.innerHTML = '<div class="docx-host" id="dh"></div>'; await m.renderAsync(blob, $("#dh"), null, { inWrapper: true, ignoreLastRenderedPageBreak: true }); }
    else if (ext === "pptx") { fb.innerHTML = '<div class="pptx-host" id="ph"></div>'; await renderPptx(blob, $("#ph"), Math.min(960, fb.clientWidth - 40)); }
    else if (["xlsx", "xls", "csv"].includes(ext)) {
      const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
      const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
      fb.innerHTML = '<div style="overflow:auto;max-height:calc(100vh - 170px);padding:0">' + wb.SheetNames.map((n) => '<p class="note" style="padding:10px 14px 0"><b>' + esc(n) + "</b></p>" + XLSX.utils.sheet_to_html(wb.Sheets[n]).replace("<table", '<table class="grid" style="margin:8px 14px 18px"')).join("") + "</div>";
    } else if (["md", "txt", "json", "tex", "py", "js", "ts", "csv", "yaml", "yml"].includes(ext)) { const t = await blob.text(); fb.innerHTML = ext === "md" ? '<div class="paper prose">' + md(t) + "</div>" : '<pre style="margin:0;padding:18px;font:13px/1.6 var(--mono);white-space:pre-wrap">' + esc(t) + "</pre>"; }
    else fb.innerHTML = '<div class="empty"><p>No preview for .' + esc(ext) + ' files — download it to open.</p></div>';
  } catch (e) { fb.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
  const cv = $("#conv");
  if (cv) cv.onclick = async () => {
    cv.disabled = true; cv.textContent = "Converting…";
    try {
      const blob = await fileBlob(f.path);
      let body;
      if (ext === "docx") {
        if (!window.mammoth) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js"; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
        const { value } = await window.mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        const TD = (await import("https://cdn.jsdelivr.net/npm/turndown@7.2.4/+esm")).default;
        body = { kind: "doc", content: new TD({ headingStyle: "atx", bulletListMarker: "-" }).turndown(value) };
      } else if (ext === "md") body = { kind: "doc", content: await blob.text() };
      else if (ext === "pptx") {
        const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.2/+esm")).default;
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
        const outline = [];
        for (const n of names) {
          const xml = new DOMParser().parseFromString(await zip.file(n).async("string"), "application/xml");
          const paras = [...xml.getElementsByTagName("a:p")].map((p) => [...p.getElementsByTagName("a:t")].map((t) => t.textContent).join("")).filter((t) => t.trim());
          outline.push({ heading: paras[0] || "Slide " + (outline.length + 1), body: paras.slice(1).map((p) => "- " + p).join("\n") });
        }
        body = { kind: "slides", outline };
      } else {
        const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm");
        const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
        body = { kind: "sheet", rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }) };
      }
      const { artifact } = await api("POST", "/api/artifacts", Object.assign({ title: A.title.replace(/\.[a-z0-9]+$/i, ""), workId: A.workId || undefined, format: ext }, body));
      location.href = "/a/" + artifact.id;
    } catch (e) { toast("Couldn't convert: " + e.message); cv.disabled = false; cv.textContent = convert[1]; }
  };
}

// PowerPoint, rendered from the file itself: each slide's shapes at their positions, fills, text runs (size, weight,
// colour, bullets), pictures and background.
async function renderPptx(blob, host, width) {
  const JSZip = (await import("https://cdn.jsdelivr.net/npm/jszip@3.10.2/+esm")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = async (p) => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null; };
  const kids = (el, name) => (el ? [...el.getElementsByTagName(name)] : []);
  const one = (el, name) => kids(el, name)[0] || null;
  const pres = await xml("ppt/presentation.xml");
  const sz = one(pres, "p:sldSz");
  const W = +(sz && sz.getAttribute("cx")) || 12192000, H = +(sz && sz.getAttribute("cy")) || 6858000;
  const k = width / W;
  const color = (el) => { const c = one(el, "a:srgbClr"); return c ? "#" + c.getAttribute("val") : null; };
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  host.innerHTML = "";
  host.style.flexDirection = "column"; host.style.alignItems = "center"; host.style.gap = "16px";
  for (const n of names) {
    const doc = await xml(n);
    const relsDoc = await xml(n.replace("slides/", "slides/_rels/") + ".rels");
    const rels = {}; kids(relsDoc, "Relationship").forEach((r) => (rels[r.getAttribute("Id")] = "ppt/" + r.getAttribute("Target").replace(/^\.\.\//, "")));
    const slide = document.createElement("div");
    slide.style.cssText = "position:relative;overflow:hidden;background:#fff;border-radius:6px;box-shadow:0 1px 0 rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.08);width:" + width + "px;height:" + Math.round(H * k) + "px;flex:none";
    const bg = one(one(doc, "p:bg"), "a:solidFill"); if (bg && color(bg)) slide.style.background = color(bg);
    for (const sp of kids(doc, "p:sp").concat(kids(doc, "p:pic"))) {
      const off = one(sp, "a:off"), ext = one(sp, "a:ext"); if (!off || !ext) continue;
      const box = document.createElement("div");
      box.style.cssText = "position:absolute;left:" + off.getAttribute("x") * k + "px;top:" + off.getAttribute("y") * k + "px;width:" + ext.getAttribute("cx") * k + "px;height:" + ext.getAttribute("cy") * k + "px;box-sizing:border-box;overflow:hidden;font-family:Helvetica,Arial,sans-serif";
      const spPr = one(sp, "p:spPr"); const fill = spPr && [...spPr.children].find((c) => c.tagName === "a:solidFill"); if (fill && color(fill)) box.style.background = color(fill);
      const blip = one(sp, "a:blip");
      if (blip) { const target = rels[blip.getAttribute("r:embed")]; const f = target && zip.file(target); if (f) { const img = document.createElement("img"); img.src = URL.createObjectURL(await f.async("blob")); img.style.cssText = "width:100%;height:100%;object-fit:contain"; box.appendChild(img); } }
      const body = one(sp, "p:txBody");
      if (body) {
        const anchor = (one(body, "a:bodyPr") || { getAttribute: () => null }).getAttribute("anchor");
        box.style.display = "flex"; box.style.flexDirection = "column"; box.style.justifyContent = anchor === "ctr" ? "center" : anchor === "b" ? "flex-end" : "flex-start"; box.style.padding = 91440 * k + "px " + 91440 * k + "px";
        for (const para of kids(body, "a:p")) {
          const pEl = document.createElement("div");
          const pPr = one(para, "a:pPr"); const algn = pPr && pPr.getAttribute("algn"); if (algn === "ctr") pEl.style.textAlign = "center"; if (algn === "r") pEl.style.textAlign = "right";
          const bullet = pPr && (one(pPr, "a:buChar") || one(pPr, "a:buAutoNum"));
          const runs = kids(para, "a:r");
          if (!runs.length) { pEl.innerHTML = "&nbsp;"; pEl.style.fontSize = 18 * 12700 * k + "px"; }
          if (bullet) pEl.append("• ");
          for (const r of runs) {
            const rPr = one(r, "a:rPr"); const span = document.createElement("span"); span.textContent = (one(r, "a:t") || {}).textContent || "";
            const size = rPr && rPr.getAttribute("sz"); span.style.fontSize = ((size ? +size / 100 : 18) * 12700 * k) + "px";
            if (rPr && rPr.getAttribute("b") === "1") span.style.fontWeight = "700"; if (rPr && rPr.getAttribute("i") === "1") span.style.fontStyle = "italic";
            const c = rPr && color(rPr); if (c) span.style.color = c;
            pEl.appendChild(span);
          }
          pEl.style.lineHeight = "1.25"; pEl.style.margin = "0 0 " + 6 * 12700 * k + "px";
          box.appendChild(pEl);
        }
      }
      slide.appendChild(box);
    }
    host.appendChild(slide);
  }
  if (!names.length) host.innerHTML = '<p class="note">No slides found in this file.</p>';
}

// ---------- boot ----------
(async () => {
  try { await load(); } catch (e) { main.innerHTML = '<div class="empty"><h2>Not found</h2><p>This artifact doesn\'t exist, or it hasn\'t been shared with you.</p><p><a class="btn" href="/app">Open AnyDock</a></p></div>'; return; }
  ({ doc: docView, slides: slidesView, sheet: sheetView, latex: sourceView, html: sourceView, app: appView, file: fileView })[A.kind]();
  connect();
})();
`;
