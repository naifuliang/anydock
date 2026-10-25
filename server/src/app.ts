// anydock.ai/app — the signed-in dashboard. One server-rendered shell; views are plain JS over the JSON API.
// Same visual language as the landing page: white, near-black type, one blue accent, Geist + Instrument Serif,
// real brand marks and Lucide line icons.
import { line, logo } from "./icons.ts";
import { LOGO } from "./landing.ts";
import { ORGANIZATION_UI } from "./organization-ui.ts";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

// Icons the browser code needs, rendered once on the server.
const ICONS = {
  home: line("layers", 17), works: line("scroll-text", 17), inbox: line("inbox", 17), projects: line("folder-kanban", 17),
  permissions: line("shield-check", 17), connections: line("plug", 17), search: line("search", 15), share: line("arrow-left-right", 15),
  handover: line("repeat", 15), why: line("message-circle-question", 15), user: line("users", 14), tool: line("terminal", 14),
  key: line("key-round", 16), sparkles: line("sparkles", 15), mail: line("mail", 16), zap: line("zap", 16), lock: line("lock", 14),
  artifacts: line("file-text", 17), deck: line("presentation", 15),
  check: line("shield-check", 15), logout: line("log-out", 15), bot: line("bot", 15), refresh: line("refresh-cw", 14), plug: line("plug", 16),
};
const MARKS = {
  "claude-code": logo("claude", 16), codex: logo("codex", 16), claude: logo("claude", 22), codexL: logo("codex", 22), cursor: logo("cursor", 22, "#0a0a0b"),
  slack: logo("slack", 22), gmail: logo("gmail", 22), outlook: logo("outlook", 22), proton: logo("protonmail", 22), discord: logo("discord", 22), github: logo("github", 22, "#0a0a0b"), google: logo("google", 22),
  notion: logo("notion", 22, "#0a0a0b"), linear: logo("linear", 22), stripe: logo("stripe", 22), mcp: logo("mcp", 22, "#0a0a0b"),
};

export function appPage(user: { name: string; email: string; image?: string | null }, origin: string, discord = false): string {
  const boot = JSON.stringify({ user: { name: user.name, email: user.email }, origin, discord }).replace(/</g, "\\u003c");
  const prompt = `Set up AnyDock for me: follow ${origin}/agents.md`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>AnyDock</title>
<link rel="icon" href="/img/icon.svg?v=2" type="image/svg+xml"><link rel="icon" href="/img/icon-32.png?v=2" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#fafafa; --card:#fff; --text:#0a0a0b; --muted:#5d5d66; --faint:#a1a1aa; --line:rgba(10,10,12,.08); --line2:rgba(10,10,12,.13);
    --soft:#f4f4f5; --hover:#f4f4f5; --accent:#2b59ff; --accent-soft:#eef2ff; --ok:#15803d; --ok-soft:#e8f6ec; --warn:#b45309; --warn-soft:#fdf3e4;
    --err:#b91c1c; --err-soft:#fdecec; --code:#0f0f12; --code-fg:#ececef;
    --shadow:0 1px 2px rgba(10,10,12,.04), 0 12px 40px -18px rgba(10,10,12,.14);
    --serif:"Instrument Serif", ui-serif, Georgia, serif; --mono:"Geist Mono", ui-monospace, monospace;
  }
  * { box-sizing:border-box; }
  html, body { background:var(--bg); }
  body { margin:0; color:var(--text); font:14.5px/1.55 Geist, ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-font-smoothing:antialiased; }
  a { color:inherit; text-decoration:none; }
  code, .mono { font-family:var(--mono); }
  code { font-size:.92em; background:var(--soft); padding:1px 6px; border-radius:6px; }
  [hidden] { display:none !important; }
  svg { flex:none; }
  ::selection { background:var(--accent); color:#fff; }

  /* shell */
  .shell { display:grid; grid-template-columns:248px minmax(0, 1fr); min-height:100vh; }
  aside { background:#fff; border-right:1px solid var(--line); padding:14px 12px; display:flex; flex-direction:column; gap:2px; position:sticky; top:0; height:100vh; overflow-y:auto; }
  .brand { display:flex; align-items:center; gap:9px; font-weight:600; letter-spacing:-.02em; font-size:16.5px; padding:6px 10px 14px; }
  .who { display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid var(--line); border-radius:12px; margin-bottom:12px; background:var(--bg); }
  a.who { color:inherit; text-decoration:none; } a.who:hover { border-color:var(--line2); background:#fff; }
  .who b { display:block; font-weight:500; font-size:13.5px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .who small { display:block; color:var(--faint); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .who > div { min-width:0; flex:1; }
  .navsec { font:500 11px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.1em; padding:12px 10px 6px; }
  .nav a { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:9px; color:var(--muted); font-weight:500; font-size:14px; }
  .nav a:hover { background:var(--hover); color:var(--text); }
  .nav a.on { background:var(--text); color:#fff; }
  .nav a .badge { margin-left:auto; }
  .badge { background:var(--accent); color:#fff; border-radius:99px; font:600 11px Geist, sans-serif; padding:0 7px; line-height:18px; }
  .nav a.on .badge { background:#fff; color:var(--text); }
  .quick { margin-top:auto; border:1px solid var(--line); border-radius:12px; padding:12px; background:linear-gradient(180deg, #fff, var(--bg)); }
  .quick b { display:flex; align-items:center; gap:7px; font-size:13px; font-weight:600; margin-bottom:4px; }
  .quick p { margin:0 0 9px; color:var(--muted); font-size:12.5px; line-height:1.45; }
  .quick .cp { display:flex; align-items:center; gap:6px; width:100%; border:1px solid var(--line2); background:#fff; border-radius:8px; padding:6px 8px; font:12px var(--mono); color:var(--text); cursor:pointer; text-align:left; }
  .quick .cp span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .foot { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 6px 2px; }
  .live { display:inline-flex; align-items:center; gap:6px; font:12px var(--mono); color:var(--faint); }
  .live i { width:7px; height:7px; border-radius:50%; background:var(--faint); }
  .live.on { color:var(--ok); } .live.on i { background:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.15); }
  .iconbtn { display:inline-grid; place-items:center; width:30px; height:30px; border-radius:8px; border:0; background:transparent; color:var(--muted); cursor:pointer; }
  .iconbtn:hover { background:var(--hover); color:var(--text); }

  main { padding:28px 40px 72px; max-width:1180px; width:100%; }
  .crumbs { display:flex; align-items:center; gap:8px; color:var(--faint); font-size:13px; margin-bottom:14px; }
  .crumbs a:hover { color:var(--text); }
  .head { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:22px; }
  .head > div:first-child { flex:1; min-width:260px; }
  h1 { font-size:30px; font-weight:500; letter-spacing:-.035em; line-height:1.1; margin:0 0 6px; }
  h1 .serif { font-family:var(--serif); font-style:italic; font-weight:400; letter-spacing:-.01em; }
  .lead { color:var(--muted); margin:0; font-size:15px; }
  h2 { font-size:15px; font-weight:600; letter-spacing:-.01em; margin:0; }
  .sec { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:30px 0 12px; }
  .sec a { color:var(--muted); font-size:13px; } .sec a:hover { color:var(--text); }
  .row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

  .sess { padding:14px 16px; border-top:1px solid var(--line); } .sess:first-child { border-top:0; }
  .sess .sh { display:flex; align-items:center; gap:10px; } .sess .chips { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
  .chip.allow { background:var(--ok-soft); color:var(--ok); border-color:transparent; } .chip.ask { background:var(--warn-soft); color:var(--warn); border-color:transparent; } .chip.deny { background:#fdecec; color:#b42318; border-color:transparent; }
  .sset { gap:6px; flex-wrap:wrap; } .sset select { font:inherit; font-size:13px; border:1px solid var(--line2); border-radius:8px; padding:5px 8px; background:#fff; }
  .agrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:12px; }
  .acard { display:flex; flex-direction:column; gap:10px; background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; min-height:132px; transition:box-shadow .15s, transform .15s; }
  .acard:hover { box-shadow:0 8px 30px rgba(0,0,0,.07); transform:translateY(-1px); }
  .atop { display:flex; justify-content:space-between; align-items:center; } .atitle { font-weight:600; font-size:15px; line-height:1.3; flex:1; }
  .ameta { display:flex; align-items:center; gap:7px; font-size:12.5px; color:var(--muted); }
  .akind { display:inline-flex; align-items:center; font:600 11px Geist, sans-serif; color:var(--k); background:color-mix(in srgb, var(--k) 10%, #fff); border-radius:6px; padding:2px 7px; white-space:nowrap; }
  .aline { display:flex; align-items:center; gap:8px; padding:7px 0; border-top:1px solid var(--line); font-size:13.5px; } .aline:first-child { border-top:0; } .aline .at { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .newmenu { position:relative; } .newpop { position:absolute; right:0; top:calc(100% + 6px); width:320px; background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:0 16px 50px rgba(0,0,0,.12); padding:6px; z-index:30; }
  .newpop button, .newpop .up { display:flex; gap:10px; align-items:flex-start; width:100%; border:0; background:transparent; text-align:left; padding:9px 10px; border-radius:10px; cursor:pointer; font:inherit; }
  .newpop button:hover, .newpop .up:hover { background:var(--soft); } .newpop b { display:block; font-size:13.5px; } .newpop small { color:var(--muted); font-size:12px; } .newpop .akind { margin-top:1px; min-width:58px; justify-content:center; }
  .btn { display:inline-flex; align-items:center; gap:7px; padding:8px 13px; border-radius:9px; border:1px solid var(--line2); background:#fff;
         color:var(--text); font:500 13.5px Geist, sans-serif; cursor:pointer; white-space:nowrap; transition:border-color .15s, box-shadow .15s, transform .15s; }
  .btn:hover { border-color:rgba(10,10,12,.3); }
  .btn.solid { background:var(--text); color:#fff; border-color:var(--text); }
  .btn.solid:hover { box-shadow:0 6px 18px -8px rgba(10,10,12,.5); transform:translateY(-1px); }
  .btn.ghost { background:transparent; border-color:transparent; color:var(--muted); }
  .btn.sm { padding:5px 10px; font-size:12.5px; border-radius:8px; }
  .btn:disabled { opacity:.55; cursor:default; transform:none; }
  input, select, textarea { font:inherit; color:var(--text); background:#fff; border:1px solid var(--line2); border-radius:9px; padding:8px 11px; }
  input:focus, select:focus, textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 4px var(--accent-soft); }
  .search { display:flex; align-items:center; gap:8px; border:1px solid var(--line2); border-radius:10px; padding:0 11px; background:#fff; min-width:260px; color:var(--faint); }
  .search input { border:0; padding:8px 0; flex:1; box-shadow:none !important; background:transparent; }
  .seg { display:inline-flex; background:var(--soft); border-radius:10px; padding:3px; gap:2px; }
  .seg button { border:0; background:transparent; padding:6px 13px; border-radius:8px; font:500 13px Geist, sans-serif; color:var(--muted); cursor:pointer; }
  .seg button.on { background:#fff; color:var(--text); box-shadow:0 1px 2px rgba(10,10,12,.1); }

  .orgcard { padding:20px; overflow-wrap:anywhere; }
  .orgform { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; align-items:end; margin:12px 0; }
  .orgform label { display:flex; flex-direction:column; gap:6px; min-width:0; font-size:13px; }
  .orgform input,.orgform select,.orgform textarea { width:100%; min-width:0; }
  .orgform p { grid-column:1 / -1; color:var(--muted); font-size:13px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 1px 2px rgba(10,10,12,.03); }
  .pad { padding:18px 20px; }
  .empty { padding:44px 24px; text-align:center; color:var(--muted); }
  .empty .ei { width:48px; height:48px; margin:0 auto 14px; border-radius:14px; display:grid; place-items:center; background:var(--accent-soft); color:var(--accent); }
  .empty b { display:block; color:var(--text); font-weight:500; font-size:15.5px; margin-bottom:4px; }
  .empty p { margin:0 auto; max-width:440px; }
  .note { color:var(--muted); font-size:13px; }
  .err { color:var(--err); font-size:13px; }
  .ago { color:var(--faint); font-size:12.5px; white-space:nowrap; }

  .av { display:inline-grid; place-items:center; border-radius:50%; color:#fff; font:600 11px Geist, sans-serif; flex:none; width:28px; height:28px; }
  .av.lg { width:34px; height:34px; font-size:13px; }
  .stack { display:inline-flex; } .stack .av { border:2px solid #fff; margin-left:-8px; } .stack .av:first-child { margin-left:0; }
  .src { width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:#fff; border:1px solid var(--line); flex:none; }
  .pill { display:inline-flex; align-items:center; gap:5px; font:500 11.5px Geist, sans-serif; border-radius:99px; padding:2px 9px; border:1px solid var(--line); color:var(--muted); white-space:nowrap; }
  .pill.owner { color:var(--accent); border-color:transparent; background:var(--accent-soft); }
  .pill.shared, .pill.project, .pill.ok { color:var(--ok); border-color:transparent; background:var(--ok-soft); }
  .pill.assignee, .pill.handover, .pill.pending, .pill.warn { color:var(--warn); border-color:transparent; background:var(--warn-soft); }
  .pill.new { background:var(--accent); color:#fff; border-color:transparent; }
  .pill.executed, .pill.approved { color:var(--ok); background:var(--ok-soft); border-color:transparent; }
  .pill.denied, .pill.blocked, .pill.failed { color:var(--err); background:var(--err-soft); border-color:transparent; }
  .dot { width:7px; height:7px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.15); display:inline-block; }

  /* overview */
  .stats { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; }
  .stat { padding:16px 18px; display:flex; flex-direction:column; gap:8px; transition:border-color .2s, box-shadow .2s; }
  a.stat:hover { border-color:var(--line2); box-shadow:var(--shadow); }
  .stat .k { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; }
  .stat .k svg { color:var(--faint); }
  .stat b { font-size:30px; font-weight:500; letter-spacing:-.03em; line-height:1; }
  .stat small { color:var(--faint); font-size:12.5px; }
  .two { display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(0, 1fr); gap:18px; align-items:start; }
  .check { display:grid; grid-template-columns:28px 1fr auto; gap:12px; align-items:center; padding:12px 18px; border-bottom:1px solid var(--line); }
  .check:last-child { border-bottom:0; }
  .check .c { width:24px; height:24px; border-radius:50%; border:1.5px solid var(--line2); display:grid; place-items:center; color:#fff; }
  .check.done .c { background:#16a34a; border-color:#16a34a; }
  .check.done b { color:var(--muted); text-decoration:line-through; text-decoration-color:var(--faint); }
  .check b { font-weight:500; display:block; } .check span { color:var(--muted); font-size:13px; }
  .progress { height:6px; border-radius:6px; background:var(--soft); overflow:hidden; margin-top:10px; }
  .progress i { display:block; height:100%; background:var(--accent); border-radius:6px; transition:width .5s; }

  /* lists */
  .table { overflow:hidden; }
  .th, .tr { display:grid; grid-template-columns:minmax(0, 2.6fr) minmax(0, 1.2fr) 130px 80px 92px; gap:14px; align-items:center; padding:12px 18px; }
  .th { font:500 11.5px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.08em; border-bottom:1px solid var(--line); background:var(--bg); border-radius:16px 16px 0 0; }
  .tr { border-bottom:1px solid var(--line); transition:background .15s; }
  .tr:last-child { border-bottom:0; } a.tr:hover { background:var(--hover); }
  .cell { display:flex; align-items:center; gap:11px; min-width:0; }
  .cell .t { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cell small { display:block; color:var(--faint); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cell > div { min-width:0; }
  .num { font:13px var(--mono); color:var(--muted); }
  .mini { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid var(--line); }
  .mini:last-child { border-bottom:0; } a.mini:hover { background:var(--hover); }
  .mini > div { min-width:0; flex:1; } .mini .t { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mini small { display:block; color:var(--muted); font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .msg { display:grid; grid-template-columns:auto minmax(0, 1fr) auto; gap:14px; padding:16px 18px; border-bottom:1px solid var(--line); align-items:start; }
  .msg:last-child { border-bottom:0; } a.msg:hover { background:var(--hover); }
  .msg .line1 { color:var(--muted); font-size:13.5px; } .msg .line1 b { color:var(--text); font-weight:500; }
  .msg .t { font-weight:500; font-size:15px; margin:2px 0 6px; display:flex; align-items:center; gap:8px; }
  .msg q { display:block; quotes:none; border-left:2px solid var(--line2); padding:2px 0 2px 10px; color:var(--muted); font-size:13.5px; }
  .msg.unread { background:linear-gradient(90deg, var(--accent-soft), transparent 40%); }

  /* work detail */
  .wh { display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px; }
  .wh .src { width:46px; height:46px; border-radius:13px; }
  .wh > div { flex:1; min-width:240px; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .chip { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:#fff; border-radius:99px; padding:3px 10px 3px 4px; font-size:12.5px; color:var(--muted); }
  .chip.plain { padding-left:10px; }
  .chip .av { width:20px; height:20px; font-size:9px; }
  .detail { display:grid; grid-template-columns:minmax(0, 1fr) 320px; gap:22px; align-items:start; }
  .detail > * { min-width:0; }
  .rail { position:sticky; top:20px; display:flex; flex-direction:column; gap:14px; }
  .rail .card { padding:16px; }
  .rail h3 { display:flex; align-items:center; gap:7px; font:500 11.5px var(--mono); color:var(--faint); margin:0 0 12px; text-transform:uppercase; letter-spacing:.08em; }
  .rail form { display:flex; flex-direction:column; gap:8px; }
  .meta { display:grid; grid-template-columns:auto 1fr; gap:7px 14px; font-size:13px; margin:0; }
  .meta dt { color:var(--faint); } .meta dd { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .askbar { display:flex; gap:8px; align-items:center; padding:8px; margin-bottom:12px; position:sticky; top:12px; z-index:2; }
  .askbar .search { flex:1; border:0; min-width:0; }
  .tog { display:inline-flex; align-items:center; gap:6px; color:var(--muted); font-size:13px; padding:0 6px; cursor:pointer; user-select:none; }
  .why { margin:0 0 14px; padding:12px 14px; border-radius:12px; background:var(--accent-soft); font-size:13.5px; border:1px solid rgba(43,89,255,.15); }
  .why a { color:var(--accent); font-weight:600; font-family:var(--mono); cursor:pointer; margin-right:6px; }
  .steps { display:flex; flex-direction:column; gap:10px; }
  .step { display:grid; grid-template-columns:30px 36px minmax(0, 1fr); gap:8px; align-items:start; scroll-margin-top:90px; }
  .step .i { font:11.5px var(--mono); color:var(--faint); text-align:right; padding-top:8px; }
  .step .ic { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; background:#fff; border:1px solid var(--line); color:var(--muted); }
  .step.user .ic { background:var(--text); color:#fff; border-color:var(--text); }
  .step .b { border-radius:12px; padding:9px 13px; overflow-wrap:anywhere; white-space:pre-wrap; min-width:0; }
  .step.user .b { background:var(--soft); font-weight:500; }
  .step.assistant .b { background:#fff; border:1px solid var(--line); }
  .step.tool .b, .step.call .b { padding:5px 0 0; white-space:normal; }
  .step details { font:12.5px/1.5 var(--mono); }
  .step summary { cursor:pointer; color:var(--muted); list-style:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .step summary::-webkit-details-marker { display:none; }
  .step summary b { color:var(--text); font-weight:500; }
  .step pre { margin:8px 0 0; background:var(--code); color:var(--code-fg); padding:11px 13px; border-radius:10px; white-space:pre-wrap; overflow-wrap:anywhere; max-height:360px; overflow:auto; }
  .step.hit .b { outline:2px solid var(--accent); outline-offset:3px; }
  .step.flash .b { animation:flash 1.6s ease; }
  @keyframes flash { from { box-shadow:0 0 0 5px var(--accent-soft); } to { box-shadow:none; } }
  .tag { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 0; font-size:13px; }
  .pickup { white-space:pre-wrap; background:var(--soft); padding:9px 11px; border-radius:9px; font:12px var(--mono); margin:8px 0 0; display:flex; gap:8px; align-items:flex-start; }

  /* projects */
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; }
  .proj { padding:18px; display:flex; flex-direction:column; gap:12px; transition:border-color .2s, box-shadow .2s, transform .2s; }
  .proj:hover { border-color:var(--line2); box-shadow:var(--shadow); transform:translateY(-2px); }
  .proj .pi { width:38px; height:38px; border-radius:11px; display:grid; place-items:center; background:var(--accent-soft); color:var(--accent); }
  .proj .t { font-weight:600; font-size:16px; letter-spacing:-.01em; }
  .proj .bottom { display:flex; justify-content:space-between; align-items:center; }
  .newproj { display:flex; gap:8px; }

  /* permissions + connections */
  .perm { display:grid; grid-template-columns:minmax(0, 1.25fr) minmax(0, 1fr); gap:18px; align-items:start; }
  .rule { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:14px; align-items:center; padding:14px 18px; border-bottom:1px solid var(--line); }
  .rule:last-child { border-bottom:0; } .rule b { font-weight:500; display:flex; align-items:center; gap:8px; } .rule span { color:var(--muted); font-size:13px; }
  .tri { display:inline-flex; background:var(--soft); border-radius:10px; padding:3px; gap:2px; }
  .tri button { border:0; background:transparent; font:500 12.5px Geist, sans-serif; color:var(--faint); padding:5px 11px; border-radius:7px; cursor:pointer; }
  .tri button.on { background:#fff; box-shadow:0 1px 2px rgba(10,10,12,.12); }
  .tri button.on.allow { color:var(--ok); } .tri button.on.ask { color:var(--warn); } .tri button.on.deny { color:var(--err); }
  .tri[aria-disabled="true"] { opacity:.45; pointer-events:none; }
  .ctile { display:grid; grid-template-columns:44px minmax(0, 1fr) auto; gap:14px; align-items:center; padding:16px 18px; border-bottom:1px solid var(--line); }
  .ctile:last-child { border-bottom:0; }
  .lg { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:#fff; border:1px solid var(--line); }
  .ctile b { font-weight:500; display:block; } .ctile .note { margin-top:1px; }
  .timeline { position:relative; }
  .ev { display:grid; grid-template-columns:20px minmax(0, 1fr) auto; gap:12px; padding:13px 18px; border-bottom:1px solid var(--line); align-items:start; }
  .ev:last-child { border-bottom:0; }
  .ev .d { width:10px; height:10px; border-radius:50%; margin:6px 0 0 4px; background:var(--faint); box-shadow:0 0 0 4px var(--soft); }
  .ev.executed .d, .ev.approved .d { background:#16a34a; box-shadow:0 0 0 4px var(--ok-soft); }
  .ev.pending .d { background:#f59e0b; box-shadow:0 0 0 4px var(--warn-soft); }
  .ev.denied .d, .ev.blocked .d, .ev.failed .d { background:#dc2626; box-shadow:0 0 0 4px var(--err-soft); }
  .ev .t { font-weight:500; overflow-wrap:anywhere; } .ev .m { color:var(--muted); font-size:12.5px; margin-top:2px; }
  .igrid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:14px; }
  .itile { padding:18px; display:flex; flex-direction:column; gap:12px; min-height:178px; }
  .itile.soon { background:var(--bg); border-style:dashed; }
  .itile .top { display:flex; align-items:center; gap:12px; } .itile .top b { font-weight:500; font-size:15px; }
  .itile p { margin:0; color:var(--muted); font-size:13.5px; line-height:1.5; flex:1; }
  .itile .foot2 { display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .banner { display:flex; gap:12px; align-items:center; padding:13px 16px; border-radius:14px; background:var(--ok-soft); color:var(--ok); margin-bottom:16px; font-weight:500; }

  /* overlays */
  /* "More ▾" on approvals: this session (15 min / 8 h) or always (two clicks) */
  details.more { position:relative; display:inline-block; } details.more > summary { list-style:none; cursor:pointer; } details.more > summary::-webkit-details-marker { display:none; }
  details.more .mm { position:absolute; right:0; bottom:calc(100% + 6px); z-index:40; min-width:250px; background:#fff; border:1px solid var(--line2); border-radius:12px; box-shadow:0 18px 40px -16px rgba(0,0,0,.3); padding:5px; display:flex; flex-direction:column; }
  details.more .mm button { text-align:left; border:0; background:transparent; padding:8px 10px; border-radius:8px; font:500 13px Geist, sans-serif; color:var(--text); cursor:pointer; }
  details.more .mm button:hover { background:var(--soft); } details.more .mm small { display:block; color:var(--muted); font-weight:400; }
  .armed, details.more .mm button.armed { background:#fef2f2 !important; color:#b42318 !important; box-shadow:inset 0 0 0 1px #f3b5b0; }
  .approval { position:fixed; right:20px; bottom:20px; z-index:30; width:min(390px, calc(100vw - 32px)); background:#fff; border:1px solid var(--line2); border-radius:16px;
              box-shadow:0 30px 70px -24px rgba(10,10,12,.45); padding:16px; display:grid; gap:10px; animation:pop .3s cubic-bezier(.2,.8,.2,1); }
  .approval .ah { display:flex; align-items:center; gap:10px; font-weight:600; }
  .approval .ah span { width:30px; height:30px; border-radius:9px; display:grid; place-items:center; background:var(--warn-soft); color:var(--warn); }
  .approval .what { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; font-size:13.5px; }
  .approval .row { justify-content:flex-end; }
  @keyframes pop { from { opacity:0; transform:translateY(12px) scale(.98); } }
  .toast { position:fixed; left:50%; bottom:22px; transform:translate(-50%, 20px); background:var(--text); color:#fff; padding:10px 16px; border-radius:99px; font-size:13.5px;
           box-shadow:0 12px 30px rgba(10,10,12,.3); opacity:0; transition:.25s; pointer-events:none; z-index:40; white-space:nowrap; max-width:calc(100vw - 32px); overflow:hidden; text-overflow:ellipsis; }
  .toast.on { transform:translate(-50%, 0); opacity:1; }
  .skel { height:14px; border-radius:6px; background:linear-gradient(90deg, var(--soft), #fafafa, var(--soft)); background-size:200% 100%; animation:sk 1.2s infinite; }
  @keyframes sk { to { background-position:-200% 0; } }

  @media (max-width: 1100px) { .stats { grid-template-columns:repeat(2, minmax(0, 1fr)); } .igrid { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 900px) {
    .shell { grid-template-columns:minmax(0, 1fr); grid-template-rows:auto 1fr; align-items:start; }
    aside { position:sticky; top:0; z-index:20; height:auto; flex-direction:row; align-items:center; gap:4px; border-right:0; border-bottom:1px solid var(--line); padding:8px 10px; overflow-x:auto; }
    .brand { padding:4px 8px; } .brand span.name, .who, .navsec, .quick, .foot { display:none; }
    .nav { display:flex; gap:2px; } .nav a { padding:7px 10px; white-space:nowrap; } .nav a span.label { display:none; }
    main { padding:20px 16px 56px; }
    .two, .detail, .perm { grid-template-columns:minmax(0, 1fr); } .rail { position:static; }
    .th { display:none; } .tr { grid-template-columns:minmax(0, 1fr) auto; } .tr > :nth-child(2), .tr > :nth-child(4) { display:none; }
    .search { min-width:0; flex:1; }
  }
  @media (max-width: 620px) { .stats { grid-template-columns:repeat(2, minmax(0, 1fr)); } .igrid { grid-template-columns:minmax(0, 1fr); } h1 { font-size:25px; } .tr > :nth-child(5) { display:none; }
    .stat b { font-size:26px; } .stat small { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .head .search { min-width:0; width:100%; } }
</style>
</head>
<body>
<div class="shell">
  <aside>
    <a class="brand" href="/">${LOGO}<span class="name">AnyDock</span></a>
    <a class="who" href="#/permissions" title="Edit your name and phone"><span class="av lg" id="meAv"></span><div><b>${esc(user.name || user.email.split("@")[0]!)}</b><small>${esc(user.email)}</small></div></a>
    <nav class="nav">
      <div class="navsec">Work</div>
      <a href="#/" data-nav="home">${ICONS.home}<span class="label">Overview</span></a>
      <a href="#/works" data-nav="works">${ICONS.works}<span class="label">Works</span></a>
      <a href="#/artifacts" data-nav="artifacts">${ICONS.artifacts}<span class="label">Artifacts</span></a>
      <a href="#/inbox" data-nav="inbox">${ICONS.inbox}<span class="label">Inbox</span><span class="badge" id="unread" hidden></span></a>
      <div class="navsec">Team</div>
      <a href="#/projects" data-nav="projects">${ICONS.projects}<span class="label">Projects</span></a>
      <a href="#/organizations" data-nav="organizations">${ICONS.user}<span class="label">Organizations</span></a>
      <div class="navsec">Trust</div>
      <a href="#/permissions" data-nav="permissions">${ICONS.permissions}<span class="label">Permissions</span></a>
      <a href="#/settings" data-nav="settings">${ICONS.connections}<span class="label">Integrations</span></a>
    </nav>
    <div class="quick"><b>${ICONS.sparkles} Connect an agent</b><p>Paste this into Claude Code, Codex or Cursor.</p>
      <button class="cp" id="copyPrompt" type="button" title="Copy">${ICONS.zap}<span>${esc(prompt)}</span></button></div>
    <div class="foot"><span class="live" id="live"><i></i><span>connecting…</span></span><button class="iconbtn" id="signout" title="Sign out">${ICONS.logout}</button></div>
  </aside>
  <main id="view"></main>
</div>
<div class="toast" id="toast"></div>
<script>
const BOOT = ${boot};
const ICONS = ${JSON.stringify(ICONS)};
const MARKS = ${JSON.stringify(MARKS)};
const PROMPT = ${JSON.stringify(prompt)};
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
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
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
function toast(text) { const t = $("#toast"); t.textContent = text; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3000); }
const COLORS = ["#d97757", "#10a37f", "#7c3aed", "#0e7490", "#2b59ff", "#db2777", "#ca8a04", "#4f46e5"];
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };
const initials = (name, email) => { const n = (name || "").trim(); if (n) return n.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase(); return (email || "?")[0].toUpperCase(); };
const av = (name, email, cls = "") => '<span class="av ' + cls + '" style="background:' + hue(email || name) + '" title="' + esc(name || email) + '">' + esc(initials(name, email)) + '</span>';
const srcBadge = (s) => '<span class="src" title="' + srcName(s) + '">' + (MARKS[s] || MARKS["claude-code"]) + '</span>';
const srcName = (s) => s === "codex" ? "Codex" : "Claude Code";
const roleLabel = { owner: "Yours", shared: "Shared with you", assignee: "Handed to you", project: "Project" };
const empty = (icon, title, body) => '<div class="empty"><div class="ei">' + ICONS[icon] + '</div><b>' + title + '</b><p>' + body + '</p></div>';
const skel = (n = 3) => '<div class="pad">' + Array.from({ length: n }, () => '<div class="skel" style="margin:10px 0;width:' + (60 + Math.random() * 35) + '%"></div>').join("") + '</div>';

$("#meAv").outerHTML = av(BOOT.user.name, BOOT.user.email, "lg").replace("<span", '<span id="meAv"');
$("#copyPrompt").onclick = async () => { await navigator.clipboard.writeText(PROMPT); toast("Copied — paste it into your agent"); };
$("#signout").onclick = async () => { await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" }); location.href = "/"; };

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
      toast((i.fromName || short(i.fromEmail)) + (/handover/.test(i.kind) ? " handed over " : " shared ") + "“" + (i.artifactTitle || i.workTitle || "something") + "”");
      refreshUnread();
      // The Inbox and Overview list it right away.
      if (["", "#", "#/", "#/inbox", "#/artifacts"].includes(location.hash.split("?")[0])) route();
    }
    if (ev.type === "action.new" && ev.action.status === "pending") showApproval(ev.action);
    if (ev.type === "action.updated") { document.getElementById("ap-" + ev.action.id)?.remove(); refreshPending(); }
    listeners.forEach((fn) => fn(ev));
  };
  ws.onclose = () => { el.classList.remove("on"); el.lastElementChild.textContent = "reconnecting…"; setTimeout(() => connectLive(attempt + 1), Math.min(30000, 1000 * 2 ** attempt)); };
  setInterval(() => ws.readyState === 1 && ws.send("ping"), 30000);
}
// One badge for "waiting for you": unread shares/handovers + approvals to decide.
async function refreshUnread() {
  const [{ items }, { actions }] = await Promise.all([api("GET", "/api/inbox?unread=1"), api("GET", "/api/actions?status=pending")]);
  const n = items.length + actions.length;
  const b = $("#unread"); b.textContent = n; b.hidden = n === 0;
}
const refreshPending = refreshUnread;

function setNav(key) { document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === key)); }
const head = (title, lead, right = "") => '<div class="head"><div><h1>' + title + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + '</div>' + right + '</div>';

// ---------- overview ----------
async function homeView() {
  setNav("home");
  const first = (BOOT.user.name || short(BOOT.user.email)).split(/\s+/)[0];
  const hr = new Date().getHours();
  const greet = hr < 5 ? "Working late" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  view.innerHTML = head(greet + ', <span class="serif">' + esc(first) + '</span>.', "Here's what's moving across your agents and your team.") +
    '<div class="stats" id="stats">' + Array.from({ length: 4 }, () => '<div class="card stat">' + skel(2) + '</div>').join("") + '</div>' +
    '<div class="two" style="margin-top:18px"><div>' +
      '<div class="sec"><h2>Continue where you left off</h2><a href="#/works">All works →</a></div><div class="card" id="recent">' + skel() + '</div>' +
      '<div class="sec"><h2>Latest from teammates</h2><a href="#/inbox">Inbox →</a></div><div class="card" id="latest">' + skel(2) + '</div>' +
    '</div><div>' +
      '<div class="sec"><h2>Get set up</h2><span class="note" id="setupPct"></span></div><div class="card" id="setup">' + skel(4) + '</div>' +
      '<div class="sec"><h2>Waiting for you</h2><a href="#/inbox">Inbox →</a></div><div class="card" id="waiting">' + skel(1) + '</div>' +
    '</div></div>';
  const [{ works }, { items }, { projects }, del, { actions: pend }] = await Promise.all([
    api("GET", "/api/works"), api("GET", "/api/inbox"), api("GET", "/api/projects"), api("GET", "/api/delegate"), api("GET", "/api/actions?status=pending")]);
  const mine = works.filter((w) => w.role === "owner"), others = works.filter((w) => w.role !== "owner");
  const live = works.filter((w) => Date.now() - new Date(w.lastActivityAt || w.updatedAt) < 15 * 60_000);
  const stat = (href, icon, k, n, sub) => '<a class="card stat" href="' + href + '"><span class="k">' + ICONS[icon] + k + '</span><b>' + n + '</b><small>' + sub + '</small></a>';
  $("#stats").innerHTML =
    stat("#/works", "works", "Your works", mine.length, plural(mine.reduce((a, w) => a + w.stepCount, 0), "step") + " captured") +
    stat("#/works?f=shared", "share", "Shared with you", others.length, plural(items.filter((i) => !i.readAt).length, "unread") ) +
    stat("#/inbox", "permissions", "Waiting for you", pend.length, pend.length ? "approvals to review" : "nothing to approve") +
    stat("#/works", "refresh", "Live now", live.length, live.length ? "synced in the last 15 min" : "no agent activity right now");
  const recent = [...works].sort((a, b) => new Date(b.lastActivityAt || b.updatedAt) - new Date(a.lastActivityAt || a.updatedAt)).slice(0, 5);
  $("#recent").innerHTML = recent.length ? recent.map(miniWork).join("") : empty("works", "No works yet", "In Claude Code or Codex, say <code>share this session with a teammate</code> — it shows up here.");
  $("#latest").innerHTML = items.length ? items.slice(0, 3).map((i) =>
    '<a class="mini" href="#/w/' + i.workId + '">' + av(i.fromName, i.fromEmail) + '<div><div class="t">' + esc(i.workTitle) + '</div><small>' +
    esc(i.fromName || short(i.fromEmail)) + (i.kind === "handover" ? " handed it to you" : " shared it with you") + (i.body ? " · “" + esc(i.body) + "”" : "") + '</small></div>' +
    (i.readAt ? '<span class="ago">' + ago(i.createdAt) + '</span>' : '<span class="pill new">new</span>') + '</a>').join("")
    : empty("inbox", "Nothing from teammates yet", "When someone shares or hands over work, it lands here — live.");
  const steps = [
    { done: works.length > 0, t: "Connect your agent", d: "Paste the prompt from the sidebar into Claude Code or Codex.", a: '<button class="btn sm" data-copy>Copy prompt</button>' },
    { done: mine.some((w) => w.visibility !== "private"), t: "Share your first work", d: "Say “share this with …” in your agent.", a: '<a class="btn sm" href="#/works">Open works</a>' },
    { done: projects.length > 0, t: "Create a team project", d: "Everyone in it can read its works.", a: '<a class="btn sm" href="#/projects">New project</a>' },
    { done: del.connections.slack.connected, t: "Connect Slack", d: "Let agents post as you, with approvals in Slack.", a: '<a class="btn sm" href="#/permissions">Connect</a>' },
  ];
  const n = steps.filter((s) => s.done).length;
  $("#setupPct").textContent = n + " of " + steps.length;
  $("#setup").innerHTML = steps.map((s) => '<div class="check' + (s.done ? " done" : "") + '"><span class="c">' + (s.done ? ICONS.check : "") + '</span><div><b>' + s.t + '</b><span>' + s.d + '</span></div>' + (s.done ? '' : s.a) + '</div>').join("") +
    '<div class="pad" style="padding-top:4px"><div class="progress"><i style="width:' + (n / steps.length * 100) + '%"></i></div></div>';
  view.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => { await navigator.clipboard.writeText(PROMPT); toast("Copied — paste it into your agent"); });
  $("#waiting").innerHTML = pend.length ? pend.slice(0, 4).map((a) => '<div class="mini"><span class="src">' + ICONS.key + '</span><div><div class="t">' + esc(a.summary) + '</div><small>' + esc(a.agent || "agent") + ' · ' + ago(a.createdAt) + '</small></div>' +
    '<button class="btn sm" data-deny="' + a.id + '">Deny</button>' + sessBtn(a) + '<button class="btn sm solid" data-ok="' + a.id + '">Approve</button></div>').join("")
    : empty("permissions", "All clear", "Actions that need your OK show up here and in Slack.");
  bindDecide();
}
function miniWork(w) {
  const fresh = Date.now() - new Date(w.lastActivityAt || w.updatedAt) < 15 * 60_000;
  return '<a class="mini" href="#/w/' + w.id + '">' + srcBadge(w.source) + '<div><div class="t">' + esc(w.title) + '</div><small>' +
    (w.role === "owner" ? "You" : esc(w.ownerName || short(w.ownerEmail))) + ' · ' + plural(w.stepCount, "step") + ' · ' + ago(w.lastActivityAt || w.updatedAt) + '</small></div>' +
    (fresh ? '<span class="dot" title="live"></span>' : '<span class="pill ' + w.role + '">' + roleLabel[w.role] + '</span>') + '</a>';
}

// ---------- works ----------
async function worksView(params) {
  setNav("works");
  let filter = params.get("f") || "all", q = "";
  view.innerHTML = head("Works", "Agent sessions you own, and ones teammates shared or handed to you.",
    '<div class="row"><label class="search">' + ICONS.search + '<input id="wq" placeholder="Search works…"></label>' +
    '<div class="seg" id="seg">' + ["all", "mine", "shared"].map((f) => '<button data-f="' + f + '" class="' + (f === filter ? "on" : "") + '">' + ({ all: "All", mine: "Mine", shared: "Shared with me" })[f] + "</button>").join("") + '</div></div>') +
    '<div class="card table"><div class="th"><span>Work</span><span>Owner</span><span>Access</span><span>Steps</span><span>Updated</span></div><div id="list">' + skel(4) + '</div></div>';
  const { works } = await api("GET", "/api/works");
  const draw = () => {
    const shown = works.filter((w) => (filter === "all" || (filter === "mine" ? w.role === "owner" : w.role !== "owner")) && (!q || (w.title + " " + (w.ownerEmail || "")).toLowerCase().includes(q)));
    $("#list").innerHTML = shown.length ? shown.map(workRow).join("") : (q ? empty("search", "No match", "Nothing matches “" + esc(q) + "”.") :
      filter === "shared" ? empty("share", "Nothing shared with you yet", "When a teammate shares or hands over work, it appears here.") :
      empty("works", "No works yet", "In Claude Code or Codex, say <code>share this session with a teammate@company.com</code>, or run <code>anydock sync &lt;session-id&gt;</code>."));
  };
  $("#seg").onclick = (e) => { if (!e.target.dataset.f) return; filter = e.target.dataset.f; view.querySelectorAll("#seg button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); };
  $("#wq").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  draw();
}
function workRow(w) {
  const fresh = Date.now() - new Date(w.lastActivityAt || w.updatedAt) < 15 * 60_000;
  const folder = w.cwd ? w.cwd.split("/").slice(-2).join("/") : srcName(w.source);
  return '<a class="tr" href="#/w/' + w.id + '"><div class="cell">' + srcBadge(w.source) + '<div><div class="t">' + esc(w.title) + '</div><small>' + esc(folder) + '</small></div></div>' +
    '<div class="cell">' + (w.role === "owner" ? av(BOOT.user.name, BOOT.user.email) + '<span>You</span>' : av(w.ownerName, w.ownerEmail) + '<span style="overflow:hidden;text-overflow:ellipsis">' + esc(w.ownerName || short(w.ownerEmail)) + '</span>') + '</div>' +
    '<div><span class="pill ' + w.role + '">' + roleLabel[w.role] + '</span></div><div class="num">' + w.stepCount + '</div>' +
    '<div class="ago">' + (fresh ? '<span class="dot" style="margin-right:6px"></span>' : '') + ago(w.lastActivityAt || w.updatedAt) + '</div></a>';
}

// ---------- artifacts ----------
const ARTIFACT_NOUN = { doc: "a doc", slides: "a deck", sheet: "a sheet", latex: "a LaTeX doc", html: "a web page", app: "an app", file: "a file" };
const KIND_LABEL = { doc: "Doc", slides: "Slides", sheet: "Sheet", latex: "LaTeX", html: "Web page", app: "App", file: "File" };
const KIND_COLOR = { doc: "#2b59ff", slides: "#f76b15", sheet: "#12a594", latex: "#8e4ec6", html: "#d6409f", app: "#0a0a0b", file: "#5d5d66" };
function artifactLine(a) {
  return '<a class="aline" href="/a/' + a.id + '"><span class="akind" style="--k:' + KIND_COLOR[a.kind] + '">' + esc(KIND_LABEL[a.kind]) + '</span><span class="at">' + esc(a.title) + '</span><span class="ago">' + ago(a.updatedAt) + '</span></a>';
}
async function artifactsView(params) {
  setNav("artifacts");
  let filter = params.get("f") || "all", q = "";
  view.innerHTML = head("Artifacts", "Docs, decks, sheets, pages and apps your agents and teammates make — live, shared and handed over with the work.",
    '<div class="row"><label class="search">' + ICONS.search + '<input id="aq" placeholder="Search artifacts…"></label>' +
    '<div class="seg" id="aseg">' + ["all", "mine", "shared"].map((f) => '<button data-f="' + f + '" class="' + (f === filter ? "on" : "") + '">' + ({ all: "All", mine: "Mine", shared: "Shared with me" })[f] + "</button>").join("") + '</div>' +
    '<div class="newmenu"><button class="btn solid" id="newBtn">+ New</button><div class="newpop" id="newPop" hidden>' +
      [["doc", "Document", "Write together, section by section"], ["slides", "Slides", "A deck you can present and export to .pptx"], ["sheet", "Spreadsheet", "A live grid with formulas; .xlsx in and out"], ["html", "Web page", "HTML with a live preview"], ["latex", "LaTeX", "Source with a live typeset preview"]]
        .map((k) => '<button data-new="' + k[0] + '"><span class="akind" style="--k:' + KIND_COLOR[k[0]] + '">' + KIND_LABEL[k[0]] + '</span><span><b>' + k[1] + '</b><small>' + k[2] + '</small></span></button>').join("") +
      '<label class="up"><input type="file" id="upFile" hidden><span class="akind" style="--k:' + KIND_COLOR.file + '">File</span><span><b>Upload a file</b><small>Word, PowerPoint, Excel, PDF, images…</small></span></label></div></div></div>') +
    '<div class="agrid" id="alist">' + '<div class="card">' + skel(3) + '</div></div>';
  const { artifacts } = await api("GET", "/api/artifacts");
  const me = BOOT.user.email.toLowerCase();
  const draw = () => {
    const shown = artifacts.filter((a) => (filter === "all" || (filter === "mine" ? (a.ownerEmail || "").toLowerCase() === me : (a.ownerEmail || "").toLowerCase() !== me)) && (!q || a.title.toLowerCase().includes(q)));
    $("#alist").innerHTML = shown.length ? shown.map((a) =>
      '<a class="acard" href="/a/' + a.id + '"><div class="atop"><span class="akind" style="--k:' + KIND_COLOR[a.kind] + '">' + esc(KIND_LABEL[a.kind]) + (a.kind === "file" ? " · ." + esc(a.format) : "") + '</span><span class="ago">' + ago(a.updatedAt) + '</span></div>' +
      '<div class="atitle">' + esc(a.title) + '</div><div class="ameta">' + av(a.ownerName, a.ownerEmail) + '<span>' + ((a.ownerEmail || "").toLowerCase() === me ? "You" : esc(a.ownerName || short(a.ownerEmail))) + '</span>' + (a.updatedBy ? '<span class="note">· edited by ' + esc(a.updatedBy) + '</span>' : '') + '</div></a>').join("")
      : '<div class="card" style="grid-column:1/-1">' + empty("artifacts", q ? "No match" : "No artifacts yet", q ? "Nothing matches “" + esc(q) + "”." : "Ask your agent: <code>write a launch plan as an AnyDock doc</code> — or start one with + New.") + '</div>';
  };
  $("#aseg").onclick = (e) => { if (!e.target.dataset.f) return; filter = e.target.dataset.f; view.querySelectorAll("#aseg button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); };
  $("#aq").oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $("#newBtn").onclick = (e) => { e.stopPropagation(); $("#newPop").hidden = !$("#newPop").hidden; };
  document.addEventListener("click", (e) => { const p = $("#newPop"); if (p && !e.target.closest(".newmenu")) p.hidden = true; }, { once: false });
  view.querySelectorAll("[data-new]").forEach((b) => (b.onclick = async () => {
    const kind = b.dataset.new;
    const body = { title: "Untitled " + KIND_LABEL[kind].toLowerCase(), kind };
    if (kind === "doc") body.outline = [{ heading: "Untitled", level: 1, brief: "What is this about?" }];
    if (kind === "slides") body.outline = [{ heading: "Title", brief: "Subtitle" }];
    if (kind === "html") body.content = "<!doctype html>\n<h1>Hello</h1>\n";
    if (kind === "latex") body.content = "\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n";
    const { artifact } = await api("POST", "/api/artifacts", body);
    location.href = "/a/" + artifact.id;
  }));
  $("#upFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    toast("Uploading " + f.name + "…");
    const ext = (f.name.split(".").pop() || "bin").toLowerCase();
    const { artifact } = await api("POST", "/api/artifacts", { title: f.name, kind: "file", format: ext });
    const { version } = await api("POST", "/api/artifacts/" + artifact.id + "/versions");
    const res = await fetch("/api/artifacts/" + artifact.id + "/versions/" + version + "/files/" + encodeURIComponent(f.name), { method: "PUT", headers: { "content-type": f.type || "application/octet-stream" }, body: f });
    if (!res.ok) return toast("Upload failed");
    await api("POST", "/api/artifacts/" + artifact.id + "/versions/" + version + "/done");
    location.href = "/a/" + artifact.id;
  };
  draw();
}

// ---------- inbox: everything waiting for you ----------
const VIA = { mac: "on your Mac (Touch ID / password)", slack: "in Slack", dashboard: "in the dashboard", agent: "in your agent", rule: "by your rule" };
async function inboxView() {
  setNav("inbox");
  view.innerHTML = head("Inbox", "Everything waiting for you: approvals your agents asked for, and work teammates sent you.") + '<div id="inboxBody"><div class="card">' + skel(3) + '</div></div>';
  const [{ items }, { actions: pend }] = await Promise.all([api("GET", "/api/inbox"), api("GET", "/api/actions?status=pending")]);
  const approvals = pend.length ? '<div class="sec" style="margin-top:0"><h2>Needs your decision</h2><span class="note">' + plural(pend.length, "request") + '</span></div><div class="card">' +
    pend.map((a) => '<div class="msg"><span class="src" style="background:var(--warn-soft);border-color:transparent;color:var(--warn)">' + ICONS.key + '</span>' +
      '<div style="min-width:0"><div class="line1"><b>' + esc(a.agent || "Your agent") + '</b> wants to</div><div class="t">' + esc(a.summary) + '</div>' +
      '<div class="note">Your rule: ask me · ' + ago(a.createdAt) + ' · also on your Mac and in Slack if connected</div></div>' +
      '<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-deny="' + a.id + '">Deny</button>' + sessBtn(a) + '<button class="btn sm solid" data-ok="' + a.id + '">Approve</button></div></div>').join("") + '</div>' : "";
  const sent = '<div class="sec"' + (pend.length ? '' : ' style="margin-top:0"') + '><h2>From teammates</h2><span class="note">' + plural(items.filter((i) => !i.readAt).length, "unread") + '</span></div><div class="card">' + (items.length ? items.map((i) =>
    '<a class="msg' + (i.readAt ? "" : " unread") + '" href="' + (i.artifactId ? "/a/" + i.artifactId : "#/w/" + i.workId) + '" data-read="' + (i.readAt ? "" : i.id) + '">' + av(i.fromName, i.fromEmail, "lg") +
    '<div style="min-width:0"><div class="line1"><b>' + esc(i.fromName || short(i.fromEmail)) + '</b> ' + (i.artifactId ? (i.kind === "artifact.access_request" ? "asks for access to " + (ARTIFACT_NOUN[i.artifactKind] || "a file") + " of yours" : (i.kind === "artifact.handover" ? "handed over " : "shared ") + (ARTIFACT_NOUN[i.artifactKind] || "a file") + " with you") : i.kind === "handover" ? "handed over a work to you" : "shared a work with you") + '</div>' +
    '<div class="t">' + (i.artifactId ? ICONS.artifacts + esc(i.artifactTitle) : (MARKS[i.workSource] || "") + esc(i.workTitle)) + '</div>' + (i.body ? '<q>' + esc(i.body) + '</q>' : '') + '</div>' +
    '<div class="row" style="flex-direction:column;align-items:flex-end;gap:6px">' + (i.readAt ? "" : '<span class="pill new">new</span>') + '<span class="pill ' + (/handover/.test(i.kind) ? "handover" : "share") + '">' + (/handover/.test(i.kind) ? "Handover" : /access_request/.test(i.kind) ? "Request" : "Share") + '</span><span class="ago">' + ago(i.createdAt) + "</span></div></a>").join("")
    : empty("inbox", "Nothing from teammates yet", "When someone shares or hands over work to you, it shows up here — live.")) + '</div>';
  $("#inboxBody").innerHTML = approvals + sent;
  bindDecide();
  view.querySelectorAll("[data-read]").forEach((a) => a.dataset.read && a.addEventListener("click", () => api("POST", "/api/inbox/" + a.dataset.read + "/read").then(refreshUnread)));
}

// ---------- work detail (trajectory viewer) ----------
async function workView(id) {
  setNav("works");
  view.innerHTML = '<div class="card">' + skel(6) + '</div>';
  const [{ work }, projectsRes] = await Promise.all([api("GET", "/api/works/" + id), api("GET", "/api/projects")]);
  const canShare = work.role === "owner" || work.role === "assignee";
  const fresh = Date.now() - new Date(work.lastActivityAt || work.updatedAt) < 15 * 60_000;
  view.innerHTML =
    '<div class="crumbs"><a href="#/works">Works</a><span>/</span><span>' + esc(work.title) + '</span></div>' +
    '<div class="wh">' + srcBadge(work.source) + '<div><h1 style="font-size:26px">' + esc(work.title) + '</h1><div class="chips">' +
      '<span class="chip">' + av(work.ownerName, work.ownerEmail) + (work.role === "owner" ? "You" : esc(work.ownerName || work.ownerEmail)) + '</span>' +
      '<span class="chip plain">' + srcName(work.source) + '</span><span class="chip plain"><span id="count">' + work.stepCount + '</span>&nbsp;steps</span>' +
      '<span class="chip plain">' + (fresh ? '<span class="dot" style="margin-right:6px"></span>live · ' : '') + 'updated ' + ago(work.lastActivityAt || work.updatedAt) + '</span>' +
      '<span class="pill ' + work.role + '">' + roleLabel[work.role] + '</span></div></div></div>' +
    '<div class="detail"><div>' +
      '<div class="card askbar"><label class="search">' + ICONS.why + '<input id="q" placeholder="Ask why… e.g. why Primitive over Blaxel?"></label>' +
      '<label class="tog"><input type="checkbox" id="showTools" checked> Tool calls</label><button class="btn solid" id="ask">Ask why</button></div>' +
      '<div id="why" class="why" hidden></div><div class="steps" id="steps"></div>' +
    '</div><div class="rail">' +
      (canShare ? '<div class="card"><h3>' + ICONS.share + 'Share or hand over</h3><form id="shareForm"><input type="email" name="to" required placeholder="teammate@company.com">' +
        '<input name="note" placeholder="Add a note (optional)"><div class="row" style="flex-wrap:nowrap"><button class="btn solid" style="flex:1;justify-content:center" name="kind" value="share">' + ICONS.share + 'Share</button>' +
        '<button class="btn" style="flex:1;justify-content:center" name="kind" value="handover">' + ICONS.handover + 'Hand over</button></div>' +
        '<div id="shareMsg" class="note"></div></form><div id="shares" style="margin-top:8px"></div></div>' : '') +
      '<div class="card" id="workArts" hidden><h3>' + ICONS.artifacts + 'Artifacts</h3><div id="workArtList"></div></div>' +
      '<div class="card"><h3>' + ICONS.bot + 'Pick it up in your agent</h3><p class="note" style="margin:0">In Claude Code or Codex with AnyDock installed, say:</p>' +
        '<div class="pickup"><span style="flex:1">read AnyDock work ' + work.id.slice(0, 8) + ' and continue it</span><button class="iconbtn" id="copyPick" title="Copy" style="width:24px;height:24px">' + ICONS.zap + '</button></div></div>' +
      '<div class="card"><h3>' + ICONS.lock + 'About</h3><dl class="meta">' +
        '<dt>Owner</dt><dd>' + esc(work.ownerEmail || "") + '</dd>' +
        (work.assigneeEmail ? '<dt>Assignee</dt><dd>' + esc(work.assigneeEmail) + '</dd>' : '') +
        (work.cwd ? '<dt>Folder</dt><dd class="mono" title="' + esc(work.cwd) + '">' + esc(work.cwd.split("/").slice(-2).join("/")) + '</dd>' : '') +
        (work.gitBranch ? '<dt>Branch</dt><dd class="mono">' + esc(work.gitBranch) + '</dd>' : '') +
        '<dt>Visibility</dt><dd>' + esc(work.visibility) + '</dd></dl>' +
        (work.role === "owner" ? '<div style="margin-top:14px"><select id="proj" style="width:100%"><option value="">Not in a project</option>' +
          projectsRes.projects.map((p) => '<option value="' + p.id + '"' + (p.id === work.projectId ? " selected" : "") + '>' + esc(p.name) + "</option>").join("") +
          '</select><p class="note" style="margin:6px 0 0">Everyone in the project can read it.</p></div>' : '') + '</div>' +
    '</div></div>';
  api("GET", "/api/artifacts?workId=" + work.id).then(({ artifacts }) => { if (!artifacts.length) return; $("#workArts").hidden = false; $("#workArtList").innerHTML = artifacts.map(artifactLine).join(""); }).catch(() => {});
  $("#copyPick").onclick = async () => { await navigator.clipboard.writeText("read AnyDock work " + work.id + " and continue it"); toast("Copied"); };

  let steps = [];
  const render = () => { const showTools = $("#showTools").checked; $("#steps").innerHTML = steps.map((s, i) => stepHtml(s, i, showTools)).join("") || empty("works", "No steps yet", "This work hasn't synced any steps."); };
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

  const onEvent = async (ev) => {
    if (ev.type !== "work.updated" || ev.workId !== id || !location.hash.startsWith("#/w/" + id)) return;
    const before = steps.length; await load(before); render();
    const el = $("#steps").children[before]; el && el.classList.add("flash");
    toast(plural(ev.stepCount - before, "new step") + " just synced");
  };
  listeners.add(onEvent); cleanup = () => listeners.delete(onEvent);

  const ask = () => {
    const q = $("#q").value.trim(); const box = $("#why");
    document.querySelectorAll(".step.hit").forEach((e) => e.classList.remove("hit"));
    if (!q) { box.hidden = true; return; }
    const hits = rank(steps, q);
    box.hidden = false;
    if (!hits.length) { box.innerHTML = "No step mentions that. Try other words."; return; }
    box.innerHTML = "<b>Most relevant moments:</b> " + hits.map((i) => '<a data-go="' + i + '">[' + i + "]</a>").join("") + '<div class="note" style="margin-top:6px">' + esc(firstLine(steps[hits[0]])) + "</div>";
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
        '<div class="tag"><span class="row" style="gap:8px;flex-wrap:nowrap;min-width:0">' + av("", s.toEmail) + '<span style="overflow:hidden;text-overflow:ellipsis">' + esc(s.toEmail) + '</span><span class="pill ' + (s.kind === "handover" ? "handover" : "shared") + '">' + s.kind + '</span></span>' +
        '<button class="btn ghost sm" data-revoke="' + s.id + '">Revoke</button></div>').join("");
      $("#shares").querySelectorAll("[data-revoke]").forEach((b) => b.onclick = async () => { await api("DELETE", "/api/shares/" + b.dataset.revoke); toast("Access revoked"); loadShares(); });
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const kind = e.submitter?.value || "share"; const fd = new FormData(form);
      try {
        await api("POST", "/api/works/" + id + "/" + kind, { to: fd.get("to"), note: fd.get("note") || undefined });
        toast((kind === "handover" ? "Handed over to " : "Shared with ") + fd.get("to")); $("#shareMsg").textContent = ""; form.reset(); loadShares();
      } catch (err) { $("#shareMsg").innerHTML = '<span class="err">' + esc(err.message) + "</span>"; }
    };
    loadShares();
  }
  const sel = $("#proj");
  if (sel) sel.onchange = async () => { await api("PUT", "/api/works/" + id + "/project", { projectId: sel.value || null }); toast(sel.value ? "Added to project" : "Removed from project"); };
}
function firstLine(s) { return ((s.text || s.input || "") + "").replace(/\s+/g, " ").slice(0, 220); }
function stepHtml(s, i, showTools) {
  if (s.type === "text") {
    const icon = s.role === "user" ? ICONS.user : MARKS["claude-code"];
    return '<div class="step ' + s.role + '" id="s' + i + '"><div class="i">' + i + '</div><span class="ic">' + (s.role === "user" ? ICONS.user : ICONS.bot) + '</span><div class="b">' + esc(s.text) + "</div></div>";
  }
  if (!showTools) return "";
  const call = s.type === "tool_call";
  const headx = call ? "→ <b>" + esc(s.tool || "tool") + "</b> " + esc((s.input || "").slice(0, 140)) : "← <b>" + esc(s.tool || "result") + "</b> " + esc((s.text || "").replace(/\s+/g, " ").slice(0, 140));
  return '<div class="step ' + (call ? "call" : "tool") + '" id="s' + i + '"><div class="i">' + i + '</div><span class="ic">' + ICONS.tool + '</span><div class="b"><details><summary>' + headx + "</summary><pre>" + esc(call ? s.input : s.text) + "</pre></details></div></div>";
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

// ---------- projects ----------
async function projectsView() {
  setNav("projects");
  view.innerHTML = head("Projects", "Team spaces. Everyone in a project can read the works linked to it.",
    '<form id="newProj" class="newproj"><input name="name" required placeholder="New project name"><button class="btn solid">Create</button></form>') + '<div class="grid" id="grid"><div class="card">' + skel(3) + '</div></div>';
  const { projects } = await api("GET", "/api/projects");
  $("#grid").innerHTML = projects.length ? projects.map((p) =>
    '<a class="card proj" href="#/p/' + p.id + '"><div class="row" style="justify-content:space-between"><span class="pi">' + ICONS.projects + '</span><span class="pill ' + (p.role === "owner" ? "owner" : "project") + '">' + (p.role === "owner" ? "Owner" : "Member") + '</span></div>' +
    '<div><div class="t">' + esc(p.name) + '</div><div class="note">' + plural(p.memberCount, "member") + " · " + plural(p.workCount, "work") + '</div></div>' +
    '<div class="bottom"><span class="stack">' + Array.from({ length: Math.min(p.memberCount, 4) }, (_, k) => '<span class="av" style="background:' + COLORS[(k + p.name.length) % COLORS.length] + '"></span>').join("") + '</span><span class="note">Created ' + ago(p.createdAt) + '</span></div></a>').join("")
    : '<div class="card" style="grid-column:1/-1">' + empty("projects", "No projects yet", "Create one, add teammates, then link works to it from the work's page.") + '</div>';
  $("#newProj").onsubmit = async (e) => { e.preventDefault(); const { project } = await api("POST", "/api/projects", { name: new FormData(e.target).get("name") }); toast("Project created"); location.hash = "#/p/" + project.id; };
}
async function projectView(id, params = new URLSearchParams()) {
  setNav("projects");
  const { project, members, works } = await api("GET", "/api/projects/" + id);
  view.innerHTML = '<div class="crumbs"><a href="#/projects">Projects</a><span>/</span><span>' + esc(project.name) + '</span></div>' +
    head(esc(project.name), plural(members.length, "member") + " · " + plural(works.length, "work")) +
    '<div class="detail"><div><div class="card">' + (works.length ? works.map((w) => miniWork({ ...w, role: "project" })).join("") :
      empty("works", "No works linked yet", "Open one of your works and pick this project under About.")) + '</div></div>' +
    '<div class="rail"><div class="card"><h3>' + ICONS.user + 'Members</h3>' + members.map((m) =>
      '<div class="tag"><span class="row" style="gap:9px;flex-wrap:nowrap;min-width:0">' + av(m.name, m.email) + '<span style="min-width:0"><b style="font-weight:500;display:block">' + esc(m.name || short(m.email)) + '</b><span class="note">' + esc(m.email) + '</span></span></span><span class="pill ' + (m.role === "owner" ? "owner" : "project") + '">' + m.role + "</span></div>").join("") +
      '<form id="addMember" style="margin-top:12px"><input type="email" name="email" required placeholder="teammate@company.com"><button class="btn">Add member</button><div id="memberMsg" class="note"></div></form></div>' +
      '<div class="card" id="discordCard"><h3>' + MARKS.discord.replace('width="22" height="22"', 'width="14" height="14"') + 'Discord</h3><div class="note">Loading…</div></div></div></div>';
  discordCard(id, params.get("guild"));
  $("#addMember").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("POST", "/api/projects/" + id + "/members", { email: new FormData(e.target).get("email") }); projectView(id); toast("Member added"); }
    catch (err) { $("#memberMsg").innerHTML = '<span class="err">' + esc(err.message) + "</span>"; }
  };
}
async function discordCard(projectId, guildId) {
  const card = $("#discordCard");
  const { configured, links } = await api("GET", "/api/projects/" + projectId + "/discord");
  const headx = card.querySelector("h3").outerHTML;
  if (!configured) { card.innerHTML = headx + '<p class="note" style="margin:0">Coming soon — the AnyDock bot is being set up.</p>'; return; }
  const list = links.map((l) => '<div class="tag"><span><b style="font-weight:500">#' + esc(l.channelName) + '</b> <span class="note">· ' + esc(l.guildName) + '</span></span><button class="btn ghost sm" data-unlink="' + l.id + '">Disconnect</button></div>').join("");
  if (guildId) {
    card.innerHTML = headx + '<div class="note">Loading channels…</div>';
    try {
      const { guild, channels } = await api("GET", "/api/projects/" + projectId + "/discord/channels?guild=" + encodeURIComponent(guildId));
      card.innerHTML = headx + '<p class="note" style="margin:0 0 8px">Server <b style="color:var(--text)">' + esc(guild.name) + '</b> — pick a channel:</p>' +
        '<select id="dch" style="width:100%;margin-bottom:8px">' + channels.map((ch) => '<option value="' + ch.id + '">#' + esc(ch.name) + '</option>').join("") + '</select><button class="btn solid" id="dconnect">Connect channel</button>';
      $("#dconnect").onclick = async () => { await api("POST", "/api/projects/" + projectId + "/discord", { guildId, channelId: $("#dch").value }); toast("Discord connected"); location.hash = "#/p/" + projectId; };
    } catch (e) { card.innerHTML = headx + '<p class="err">' + esc(e.message) + '</p>'; }
    return;
  }
  card.innerHTML = headx + (list || '<p class="note" style="margin:0 0 10px">Post shares and handovers to a channel, and ask <code>/anydock why</code> there.</p>') +
    '<a class="btn" style="margin-top:8px" href="/api/discord/install?projectId=' + projectId + '">' + (links.length ? "Add another channel" : "Connect Discord") + '</a>';
  card.querySelectorAll("[data-unlink]").forEach((b) => b.onclick = async () => { await api("DELETE", "/api/projects/" + projectId + "/discord/" + b.dataset.unlink); toast("Disconnected"); discordCard(projectId); });
}

// ---------- delegate: approvals, rules, activity ----------
async function decideAction(id, approve, scope, minutes) {
  if (approve) { // some actions ask twice: a confirmation dialog on top of the approval click
    const { action: cur } = await api("GET", "/api/actions/" + id).catch(() => ({ action: null }));
    const q = cur && CONFIRM_TWICE[cur.action];
    if (q && !confirm(q + "\n\n" + cur.summary)) return;
  }
  const { action } = await api("POST", "/api/actions/" + id + "/decide", Object.assign({ approve, via: "dashboard", scope: scope || "once" }, minutes ? { minutes } : {}));
  document.getElementById("ap-" + id)?.remove();
  toast(approve ? (scope === "session" ? "Allowed for this session (" + (minutes >= 60 ? minutes / 60 + " h" : minutes + " min") + ") — " : scope === "always" ? "Always allowed — " : "Approved once — ") + (action.status === "executed" ? "done" : (action.result?.detail || action.status)) : "Denied");
  refreshPending(); route();
}
// "This session": approve now, and let the same agent session do this kind of action again without asking (for a while).
// Kinds of action that always need the person (mirrors ALWAYS_ASK in delegate.ts).
const ALWAYS_ASK = ["app.grant", "artifact.delete", "artifact.publish"];
const CONFIRM_TWICE = { "artifact.publish": "Make it public? Anyone with the link will be able to view it, without signing in." };
// Approve = once. "More ▾": allow this agent session for a while, or always (for all your agents — needs a second click).
const sessBtn = (a) => ALWAYS_ASK.includes(a.action) ? "" : '<details class="more"><summary class="btn sm">More ▾</summary><div class="mm">' +
  (a.sessionId ? '<button data-more="' + a.id + '" data-scope="session" data-min="15">This session · 15 min<small>Only this agent session, then it asks again</small></button>' +
    '<button data-more="' + a.id + '" data-scope="session" data-min="480">This session · 8 hours<small>Only this agent session</small></button>' : "") +
  '<button data-more="' + a.id + '" data-scope="always">Always allow<small>Every agent of yours, until you change the rule</small></button></div></details>';
// "Always" is never one click: the first click arms it (red), the second within 4 s confirms.
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-more]"); if (!b) return;
  e.preventDefault();
  if (b.dataset.scope === "always" && !b.classList.contains("armed")) {
    b.classList.add("armed"); b.dataset.label = b.innerHTML; b.innerHTML = "Click again to always allow<small>For every agent of yours</small>";
    setTimeout(() => { if (b.isConnected && b.classList.contains("armed")) { b.classList.remove("armed"); b.innerHTML = b.dataset.label; } }, 4000);
    return;
  }
  b.closest("details")?.removeAttribute("open");
  decideAction(b.dataset.more, true, b.dataset.scope, b.dataset.min ? +b.dataset.min : undefined);
});
function bindDecide() {
  view.querySelectorAll("[data-ok]").forEach((b) => b.onclick = () => decideAction(b.dataset.ok, true));
  view.querySelectorAll("[data-deny]").forEach((b) => b.onclick = () => decideAction(b.dataset.deny, false));
}
function showApproval(a) {
  if (document.getElementById("ap-" + a.id)) return;
  const el = document.createElement("div"); el.className = "approval"; el.id = "ap-" + a.id;
  el.innerHTML = '<div class="ah"><span>' + ICONS.key + '</span>Your agent is asking</div><div class="what">' + esc(a.summary) + '</div><p class="note" style="margin:0">' + esc(a.agent || "agent") + ' · your rule: ask me · also asking on your Mac</p>' +
    '<div class="row"><button class="btn" data-d="0">Deny</button>' + sessBtn(a) + '<button class="btn solid" data-d="1">Approve</button></div>';
  el.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => decideAction(a.id, b.dataset.d !== "0", "once"));
  document.body.appendChild(el); refreshPending();
}
// Per agent session permissions: each session inherits your rules; its own rules can only narrow them, except an
// "allow" you gave it yourself (approving "for this session", or here).
const DEC_LABEL = { allow: "Allowed", ask: "Ask me", deny: "Blocked" };
async function sessionsCard(rules) {
  const el = $("#sessCard"); if (!el) return;
  const { sessions, hours } = await api("GET", "/api/sessions");
  const live = rules.filter((r) => r.live && !ALWAYS_ASK.includes(r.key));
  el.innerHTML = sessions.length ? sessions.map((s) =>
    '<div class="sess"><div class="sh">' + (MARKS[s.source] || "") + '<div style="min-width:0;flex:1"><b>' + esc(s.title || (s.source === "codex" ? "Codex" : "Claude Code") + " session " + s.sessionId.slice(0, 8)) + '</b>' +
      '<div class="note">' + esc((s.device ? s.device + " · " : "") + (s.requests ? plural(s.requests, "request") + " · " : "") + "active " + ago(s.lastAt)) + (s.workId ? ' · <a href="#/w/' + s.workId + '">work</a>' : '') + '</div></div>' +
      (s.rules.length ? '<button class="btn sm" data-reset="' + esc(s.source + "|" + s.sessionId) + '">Back to my rules</button>' : '') + '</div>' +
      '<div class="chips">' + (s.rules.length ? s.rules.map((r) => '<span class="chip ' + r.decision + '">' + esc(r.label) + ': ' + DEC_LABEL[r.decision] + (r.scope && r.scope.to ? " (" + esc(r.scope.to.join(", ")) + ")" : "") + ' · until ' + new Date(r.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + '</span>').join("") : '<span class="note">Same as your rules</span>') + '</div>' +
      '<div class="row sset"><select data-sa="' + esc(s.source + "|" + s.sessionId) + '">' + live.map((r) => '<option value="' + r.key + '">' + esc(r.label) + '</option>').join("") + '</select>' +
      ["allow", "ask", "deny"].map((d) => '<button class="btn sm" data-sd="' + d + '" data-ss="' + esc(s.source + "|" + s.sessionId) + '">' + DEC_LABEL[d] + '</button>').join("") + '<span class="note">for this session · ' + hours + 'h</span></div></div>').join("")
    : empty("bot", "No agent sessions yet", "When an agent asks to act, its session shows up here, so you can tighten or loosen just that one.");
  el.querySelectorAll("[data-sd]").forEach((b) => b.onclick = async () => {
    const [source, sessionId] = b.dataset.ss.split("|");
    const action = el.querySelector('[data-sa="' + b.dataset.ss + '"]').value;
    try { await api("PUT", "/api/sessions/rule", { source, sessionId, action, decision: b.dataset.sd }); toast("Updated this session"); sessionsCard(rules); } catch (e) { toast(e.message); }
  });
  el.querySelectorAll("[data-reset]").forEach((b) => b.onclick = async () => {
    const [source, sessionId] = b.dataset.reset.split("|");
    await api("DELETE", "/api/sessions/rules?source=" + encodeURIComponent(source) + "&sessionId=" + encodeURIComponent(sessionId)); toast("Back to your rules"); sessionsCard(rules);
  });
}
// Your phone: where agents text you (with your rules) and where handover alerts go if you opt in.
async function phoneCard() {
  const el = $("#phoneCard"); if (!el) return;
  const p = await api("GET", "/api/me/profile");
  el.innerHTML = '<b style="display:flex;gap:8px;align-items:center;font-weight:500">' + ICONS.user + 'You</b>' +
    '<p class="note" style="margin:6px 0 10px">Your name is what teammates see on shares, handovers and edits. Texts come from AnyDock’s Inkbox identity' + (p.textingReady ? '.' : ' (being set up).') + '</p>' +
    '<form id="phoneForm" style="display:grid;gap:8px"><input name="name" placeholder="Your name" maxlength="80" value="' + esc(BOOT.user.name || "") + '"><input name="phone" placeholder="+14155550123" value="' + esc(p.phone || "") + '">' +
    '<label class="tog" style="padding:0"><input type="checkbox" name="toh"' + (p.textOnHandover ? " checked" : "") + '> Text me when work is handed to me</label>' +
    '<div class="row"><button class="btn sm solid">Save</button><span class="note" id="phoneMsg"></span></div></form>';
  $("#phoneForm").onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    try {
      const name = (fd.get("name") || "").trim();
      if (name && name !== BOOT.user.name) {
        await api("POST", "/api/auth/update-user", { name });
        BOOT.user.name = name;
        const who = document.querySelector(".who b"); if (who) who.textContent = name;
        const me = $("#meAv"); if (me) me.outerHTML = av(name, BOOT.user.email, "lg").replace("<span", '<span id="meAv"');
      }
      await api("PUT", "/api/me/profile", { phone: (fd.get("phone") || "").trim() || null, textOnHandover: fd.get("toh") === "on" });
      toast("Saved"); $("#phoneMsg").textContent = "";
    }
    catch (err) { $("#phoneMsg").innerHTML = '<span class="err">' + esc(err.message) + '</span>'; }
  };
}
function mailTile(key, mark, name, st) {
  return '<div class="ctile"><span class="lg">' + mark + '</span><div><b>' + name + '</b><div class="note">' +
    (st.connected ? 'Agents send as <b style="color:var(--text)">' + esc(st.label) + '</b>.' : st.available ? 'Connect once — agents send from your own address.' : 'Coming soon — setup pending.') + '</div></div>' +
    (st.connected ? '<button class="btn sm" data-mailoff="' + key + '">Disconnect</button>' : st.available ? '<a class="btn solid sm" href="/api/connectors/' + key + '/start">Connect</a>' : '<span class="pill">soon</span>') + '</div>';
}
const STATUS_LABEL = { pending: "Waiting for you", approved: "Approved", executed: "Done", failed: "Failed", denied: "Denied", blocked: "Blocked by rule" };
async function permissionsView(params = new URLSearchParams()) {
  setNav("permissions");
  view.innerHTML = head("Permissions", "What your agents may do as you. They never see your tokens — AnyDock checks your rule, then acts.") + '<div class="card">' + skel(5) + '</div>';
  const [{ actions: rules, connections }, { actions: log }] = await Promise.all([api("GET", "/api/delegate"), api("GET", "/api/actions")]);
  const sl = connections.slack, em = connections.email;
  view.innerHTML = head("Permissions", "What your agents may do as you. They never see your tokens — AnyDock checks your rule, then acts.") +
    (params.get("slack") === "connected" ? '<div class="banner">' + ICONS.check + 'Slack connected — your agents can now post as you, within the rules below.</div>' : '') +
    (params.get("gmail") === "connected" || params.get("outlook") === "connected" ? '<div class="banner">' + ICONS.check + 'Mailbox connected — your agents now email from your own address, within the rules below.</div>' : '') +
    '<div class="perm"><div><div class="sec" style="margin-top:0"><h2>Rules</h2><span class="note">Applies to every agent of yours</span></div><div class="card">' + rules.map((r) =>
      '<div class="rule"><div><b>' + esc(r.label) + (r.live ? '' : ' <span class="pill">soon</span>') + '</b><span>' + esc(r.sub) + '</span></div>' +
      '<div class="tri" data-k="' + r.key + '"' + (r.live ? '' : ' aria-disabled="true"') + '>' + ["allow", "ask", "deny"].map((d) =>
        '<button class="' + d + (r.decision === d ? " on" : "") + '" data-v="' + d + '"' + (ALWAYS_ASK.includes(r.key) && d === "allow" ? ' disabled title="Always needs your OK"' : '') + '>' + (d === "ask" ? "Ask me" : d[0].toUpperCase() + d.slice(1)) + '</button>').join("") + '</div></div>').join("") + '</div></div>' +
    '<div><div class="sec" style="margin-top:0"><h2>Connected tools</h2></div><div class="card">' +
      '<div class="ctile"><span class="lg">' + MARKS.slack + '</span><div><b>Slack</b><div class="note">' +
        (sl.connected ? 'Connected to <b style="color:var(--text)">' + esc(sl.label) + '</b>. Agents post as you; approvals arrive as DMs.' : sl.available ? 'Connect once — every agent of yours can then post as you, under your rules.' : 'Coming soon — the AnyDock Slack app is being set up.') + '</div></div>' +
        (sl.connected ? '<button class="btn sm" id="slackOff">Disconnect</button>' : sl.available ? '<a class="btn solid sm" href="/api/connectors/slack/start">Connect</a>' : '<span class="pill">soon</span>') + '</div>' +
      mailTile("gmail", MARKS.gmail, "Gmail", connections.gmail) + mailTile("outlook", MARKS.outlook, "Outlook", connections.outlook) +
      '<div class="ctile"><span class="lg">' + MARKS.proton + '</span><div><b>Proton Mail</b><div class="note">No public send API yet — coming soon.</div></div><span class="pill">soon</span></div>' +
      '<div class="ctile"><span class="lg">' + ICONS.mail + '</span><div><b>Account emails</b><div class="note">' +
        (em.available ? 'Sign-in codes and account notifications are sent from <b style="color:var(--text)">' + esc(em.from) + '</b>.' : 'Account email setup pending.') + '</div></div><span class="pill ' + (em.available ? 'ok' : '') + '">' + (em.available ? 'Ready' : 'Pending') + '</span></div>' +
    '</div><div class="card pad" style="margin-top:14px" id="phoneCard"><div class="note">Loading…</div></div>' +
    '<div class="card pad" style="margin-top:14px;background:var(--bg)"><b style="display:flex;gap:8px;align-items:center;font-weight:500">' + ICONS.lock + 'How approvals reach you</b><p class="note" style="margin:6px 0 0">In your agent (if it can show a prompt), as a pop-up here, and as a Slack DM with Approve / Deny. The first answer wins.</p></div></div></div>' +
    '<div class="sec"><h2>Agent sessions</h2><span class="note">Each session starts with your rules — narrow one, or allow more for just that session</span></div><div class="card" id="sessCard">' + skel(2) + '</div>' +
    '<div class="sec"><h2>Activity</h2><span class="note">Every action your agents asked for</span></div><div class="card timeline">' + (log.length ? log.map((a) =>
      '<div class="ev ' + a.status + '"><span class="d"></span><div style="min-width:0"><div class="t">' + esc(a.summary) + '</div><div class="m">' +
      '<span class="pill ' + a.status + '" style="margin-right:6px">' + (STATUS_LABEL[a.status] || a.status) + '</span>' + esc(a.agent || "agent") + ' · ' + ago(a.createdAt) +
      (a.decidedVia && a.decidedVia !== "rule" ? ' · decided ' + esc(VIA[a.decidedVia] || a.decidedVia) : '') + (a.result?.detail ? ' · ' + esc(a.result.detail) : '') + '</div></div>' +
      (a.status === "pending" ? '<div class="row" style="flex-wrap:nowrap"><button class="btn sm" data-deny="' + a.id + '">Deny</button>' + sessBtn(a) + '<button class="btn sm solid" data-ok="' + a.id + '">Approve</button></div>' : '<span></span>') + '</div>').join("")
      : empty("permissions", "No agent actions yet", "Try it: ask your agent to <code>tell #launch the build is green</code>.")) + '</div>';
  view.querySelectorAll(".tri").forEach((t) => t.querySelectorAll("button").forEach((b) => b.onclick = async () => {
    if (b.dataset.v === "allow" && !b.classList.contains("on") && !b.classList.contains("armed")) {
      b.classList.add("armed"); b.textContent = "Click again";
      setTimeout(() => { if (b.classList.contains("armed")) { b.classList.remove("armed"); b.textContent = "Allow"; } }, 4000);
      return;
    }
    b.classList.remove("armed"); if (b.dataset.v === "allow") b.textContent = "Allow";
    await api("PUT", "/api/delegate/policy", { action: t.dataset.k, decision: b.dataset.v });
    t.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); toast("Rule saved");
  }));
  bindDecide();
  const off = $("#slackOff"); if (off) off.onclick = async () => { await api("DELETE", "/api/connectors/slack"); toast("Slack disconnected"); permissionsView(); };
  phoneCard();
  sessionsCard(rules).catch(() => {});
  view.querySelectorAll("[data-mailoff]").forEach((b) => b.onclick = async () => { await api("DELETE", "/api/connectors/" + b.dataset.mailoff); toast("Mailbox disconnected"); permissionsView(); });
}

// ---------- integrations ----------
${ORGANIZATION_UI}
async function settingsView() {
  setNav("settings");
  const del = await api("GET", "/api/delegate").catch(() => null);
  const slackOn = del?.connections.slack.connected, slackAvail = del?.connections.slack.available;
  const tile = (mark, name, body, state, action = "") => '<div class="card itile' + (state === "soon" ? " soon" : "") + '"><div class="top"><span class="lg">' + mark + '</span><b>' + name + '</b></div><p>' + body + '</p>' +
    '<div class="foot2"><span class="pill ' + (state === "live" ? "ok" : state === "on" ? "owner" : "") + '">' + ({ live: "Live", on: "Connected", soon: "Coming soon", off: "Available" })[state] + '</span>' + action + '</div></div>';
  view.innerHTML = head("Integrations", "The agents you use, and the tools AnyDock can act in on your behalf.") +
    '<div class="sec" style="margin-top:0"><h2>Agents</h2></div><div class="igrid">' +
      tile(MARKS.claude, "Claude Code", "Sessions are captured locally; share, hand over and ask why from inside Claude Code.", "live", '<button class="btn sm" data-copy>Copy setup prompt</button>') +
      tile(MARKS.codexL, "Codex", "Same tools, different vendor — pick up a Claude Code handover in Codex.", "live", '<button class="btn sm" data-copy>Copy setup prompt</button>') +
      tile(MARKS.mcp, "Cursor, Windsurf, VS Code", "Any MCP client can connect to the AnyDock MCP server.", "live", '<a class="btn sm" href="/agents.md" target="_blank">Setup guide</a>') +
    '</div><div class="sec"><h2>Act on your behalf</h2></div><div class="igrid">' +
      tile(MARKS.slack, "Slack", "Agents post as you; approvals arrive as DMs with Approve / Deny.", slackOn ? "on" : slackAvail ? "off" : "soon", '<a class="btn sm' + (slackOn ? '' : ' solid') + '" href="#/permissions">' + (slackOn ? "Manage" : "Connect") + '</a>') +
      tile(MARKS.gmail, "Gmail", "Agents send from your own Gmail — teammates directly, outsiders with your OK.", del?.connections.gmail?.connected ? "on" : del?.connections.gmail?.available ? "off" : "soon", '<a class="btn sm" href="#/permissions">' + (del?.connections.gmail?.connected ? "Manage" : "Connect") + '</a>') +
      tile(MARKS.outlook, "Outlook", "Same, from your Outlook / Microsoft 365 mailbox.", del?.connections.outlook?.connected ? "on" : del?.connections.outlook?.available ? "off" : "soon", '<a class="btn sm" href="#/permissions">' + (del?.connections.outlook?.connected ? "Manage" : "Connect") + '</a>') +
      tile(MARKS.proton, "Proton Mail", "End-to-end encrypted mail. Waiting on a public send API.", "soon") +
      tile(MARKS.discord, "Discord", "Handover cards in a project channel, and /anydock why right in Discord.", BOOT.discord ? "off" : "soon", '<a class="btn sm" href="#/projects">Pick a project</a>') +
      tile(MARKS.mcp, "Manufact", "Manage server access and deployment approvals through your organization.", "off", '<a class="btn sm" href="#/organizations">Manage</a>') +
    '</div><div class="sec"><h2>Coming next</h2></div><div class="igrid">' +
      tile(MARKS.github, "GitHub", "Scoped repo access that moves with a handover.", "soon") +
      tile(MARKS.notion, "Notion", "Docs and decisions in the trajectory your teammates read.", "soon") +
      tile(MARKS.linear, "Linear", "Link works to issues; a handover reassigns the issue too.", "soon") +
    '</div>';
  view.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => { await navigator.clipboard.writeText(PROMPT); toast("Copied — paste it into your agent"); });
}

// ---------- router ----------
let cleanup = () => {};
async function route() {
  cleanup(); cleanup = () => {};
  const [h0, qs] = (location.hash.replace(/^#/, "") || "/").split("?");
  const h = h0 || "/"; const params = new URLSearchParams(qs || "");
  try {
    let m;
    if (h === "/") await homeView();
    else if (h === "/works") await worksView(params);
    else if (h === "/artifacts") await artifactsView(params);
    else if (h === "/inbox") await inboxView();
    else if (h === "/projects") await projectsView();
    else if (h === "/organizations") await organizationsView();
    else if (h === "/settings") await settingsView();
    else if (h === "/permissions") await permissionsView(params);
    else if ((m = h.match(/^\/w\/([\w-]+)$/))) await workView(m[1]);
    else if ((m = h.match(/^\/p\/([\w-]+)$/))) await projectView(m[1], params);
    else location.hash = "#/";
  } catch (e) {
    view.innerHTML = '<div class="card">' + empty("search", e.message === "not_found" ? "Not found" : "Something went wrong", e.message === "not_found" ? "It doesn't exist, or you don't have access." : esc(e.message)) + '</div>';
  }
}
let lastHash = "";
addEventListener("hashchange", () => { const same = location.hash.split("?")[0] === lastHash.split("?")[0]; lastHash = location.hash; route().then(() => same || scrollTo(0, 0)); });
lastHash = location.hash;
route(); refreshUnread(); refreshPending(); connectLive();
api("GET", "/api/actions?status=pending").then(({ actions }) => actions.slice(0, 3).forEach(showApproval)).catch(() => {});
`;
