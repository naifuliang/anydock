// anydock.ai/ — the landing page. Server-rendered, no bundle. White, minimal: near-black type, one blue accent,
// a serif italic for display words, real brand marks (Simple Icons) and line icons (Lucide), and an animated relay hero.
// Illustration slots (<figure class="art">) show a patterned fallback until /img/... exists — see tasks/image-generation.md.
import { HERO_CSS, HERO_JS, heroCarousel } from "./hero.ts";
import { brand, line, logo } from "./icons.ts";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export const LOGO = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="13" width="20" height="7" rx="2" fill="currentColor" opacity=".9"/><rect x="5" y="4" width="6" height="7" rx="1.5" fill="currentColor" opacity=".55"/><rect x="13" y="6" width="6" height="5" rx="1.5" fill="currentColor" opacity=".75"/></svg>`;

// Monogram tile for anything without a mark.
const mono = (text: string, bg: string, size = 20) =>
  `<span class="mono-mark" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.42)}px">${esc(text)}</span>`;

type Mark = { kind: "brand"; k: string; color?: string } | { kind: "line"; k: string } | { kind: "mono"; text: string; bg: string };
const markHtml = (m: Mark, size = 20) =>
  m.kind === "brand" ? logo(m.k, size, m.color) : m.kind === "line" ? line(m.k, size) : mono(m.text, m.bg, size);

// An illustration slot. Shows a dotted pattern + icon until the generated image exists at /img/<file>.
const art = (file: string, icon: string, alt: string) =>
  `<figure class="art"><span class="art-fb">${line(icon, 34)}</span><img src="/img/${file}" alt="${esc(alt)}" loading="lazy" onerror="this.remove()"></figure>`;

export function landingPage(opts: { signedIn: boolean; origin: string }): string {
  const prod = opts.origin === "https://anydock.ai";
  const cmd = prod ? "curl -fsSL https://anydock.ai/install.sh | sh" : `curl -fsSL ${opts.origin}/install.sh | ANYDOCK_SERVER=${opts.origin} sh`;
  const prompt = `Set up AnyDock for me: follow ${opts.origin}/agents.md`;
  const cta = opts.signedIn ? `<a class="btn lime" href="/app">Open dashboard →</a>` : `<a class="btn ghost" href="/login?next=/app">Sign in</a>`;
  const roles = ["All", ...new Set(CASES.map((c) => c.role))];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>AnyDock — agent work your whole team can pick up</title>
<meta name="description" content="Share, hand over and explain agent work across people and agents. Works with Claude Code, Codex and any MCP client.">
<meta property="og:title" content="AnyDock — Agents made individuals 10x. AnyDock makes teams 10x.">
<meta property="og:description" content="Share and hand over your agent's work — context, trajectory, every decision — to teammates and their agents.">
<meta property="og:image" content="${opts.origin}/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#ffffff; --bg2:#fafafa; --bg3:#f4f4f5; --line:rgba(10,10,12,.08); --line2:rgba(10,10,12,.13);
    --text:#0a0a0b; --muted:#5d5d66; --faint:#a1a1aa;
    --accent:#2b59ff; --accent-dim:rgba(43,89,255,.08); --cc:#d97757; --cx:#10a37f;
    --serif:"Instrument Serif", ui-serif, Georgia, serif; --sans:Geist, ui-sans-serif, system-ui, -apple-system, sans-serif; --mono:"Geist Mono", ui-monospace, monospace;
    --shadow:0 1px 2px rgba(10,10,12,.04), 0 12px 40px -16px rgba(10,10,12,.12);
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; background:var(--bg); }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.6 var(--sans); -webkit-font-smoothing:antialiased; overflow-x:hidden; }
  a { color:inherit; text-decoration:none; }
  [hidden] { display:none !important; }
  ::selection { background:var(--accent); color:#fff; }
  .wrap { max-width:1120px; margin:0 auto; padding:0 24px; }
  .serif { font-family:var(--serif); font-weight:400; }
  svg { flex:none; }
  .mono-mark { display:inline-grid; place-items:center; border-radius:5px; color:#fff; font-family:var(--sans); font-weight:700; letter-spacing:-.02em; flex:none; }

  nav { position:fixed; inset:0 0 auto 0; z-index:20; transition:background .2s, border-color .2s; border-bottom:1px solid transparent; }
  nav.scrolled { background:rgba(255,255,255,.82); backdrop-filter:blur(14px) saturate(1.6); border-bottom-color:var(--line); }
  nav .wrap { display:flex; align-items:center; gap:28px; height:64px; }
  .brand { display:flex; align-items:center; gap:9px; font-weight:600; letter-spacing:-.02em; font-size:17px; }
  nav .links { display:flex; align-items:center; gap:26px; margin-left:auto; font-size:14px; color:var(--muted); }
  nav .links > a:not(.btn):hover { color:var(--text); }
  .btn { display:inline-flex; align-items:center; gap:8px; padding:9px 15px; border-radius:999px; font:500 14px/1 var(--sans); cursor:pointer;
         border:1px solid var(--line2); color:var(--text); background:#fff; white-space:nowrap; transition:transform .15s, box-shadow .15s, border-color .15s; }
  .btn:hover { border-color:rgba(10,10,12,.28); }
  .btn.lime { background:var(--text); color:#fff; border-color:var(--text); }
  .btn.lime:hover { transform:translateY(-1px); box-shadow:0 8px 24px -10px rgba(10,10,12,.45); }

  /* hero */
  .hero { position:relative; padding:148px 0 96px; overflow:hidden; isolation:isolate; }
  .hero::before { content:""; position:absolute; inset:0; z-index:-2;
    background-image:linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size:72px 72px; mask-image:radial-gradient(70% 55% at 50% 25%, #000 20%, transparent 75%); opacity:.6; }
  .pill { display:inline-flex; align-items:center; gap:10px; padding:5px 14px 5px 5px; border:1px solid var(--line2); border-radius:999px; font-size:13px; color:var(--muted); background:#fff; }
  .pill b { background:var(--text); color:#fff; font:500 11px var(--mono); padding:3px 9px; border-radius:999px; letter-spacing:.04em; }
  .hero h1 { margin:28px 0 22px; font-weight:500; letter-spacing:-.045em; line-height:1; font-size:clamp(42px, 6.2vw, 84px); text-wrap:balance; }
  .hero h1 .serif { font-style:italic; letter-spacing:-.02em; }
  .hero .lede { max-width:600px; font-size:clamp(17px, 1.5vw, 19px); color:var(--muted); line-height:1.6; margin:0 auto 36px; }
  .hero .lede em { color:var(--text); font-style:normal; }
  .center { text-align:center; }

  .install { width:min(600px, 100%); margin:0 auto; border:1px solid var(--line2); border-radius:14px; background:#fff; padding:5px; text-align:left; box-shadow:var(--shadow); }
  .tabs { display:flex; gap:2px; padding:4px; }
  .tab { display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; color:var(--muted); font:500 13px var(--sans); padding:6px 11px; border-radius:8px; cursor:pointer; }
  .tab.on { background:var(--bg3); color:var(--text); }
  .cmd { display:flex; align-items:center; gap:12px; padding:10px 6px 10px 14px; min-width:0; }
  .cmd .pr { color:var(--faint); font-family:var(--mono); font-size:14px; }
  .cmd code { flex:1; min-width:0; font:13.5px/1.4 var(--mono); color:var(--text); white-space:nowrap; overflow-x:auto; scrollbar-width:none; }
  .cmd code::-webkit-scrollbar { display:none; }
  .copy { padding:7px 13px; font-size:13px; }
  .fine { display:flex; justify-content:center; align-items:center; flex-wrap:wrap; gap:14px; font:12px var(--mono); color:var(--faint); margin:16px 0 0; }
  .fine span { display:inline-flex; align-items:center; gap:6px; }

  .relay { margin:76px auto 0; display:grid; grid-template-columns:minmax(0, 1fr) 140px minmax(0, 1fr); align-items:center; max-width:1040px; }
  .win { text-align:left; background:#fff; border:1px solid var(--line2); border-radius:14px; overflow:hidden; min-width:0; box-shadow:var(--shadow); }
  .win .bar { display:flex; align-items:center; gap:7px; padding:10px 14px; border-bottom:1px solid var(--line); background:var(--bg2); font:12px var(--mono); color:var(--faint); }
  .win .bar i { width:9px; height:9px; border-radius:50%; background:#e4e4e7; }
  .win .bar .who { margin-left:8px; display:flex; align-items:center; gap:8px; color:var(--muted); }
  .win .bar .tag { display:inline-flex; align-items:center; gap:6px; padding:2px 9px 2px 6px; border-radius:99px; font-size:11px; background:#fff; border:1px solid var(--line2); color:var(--text); font-weight:500; }
  .win .body { padding:16px 16px 18px; font:13px/1.65 var(--mono); min-height:210px; }
  .ln { opacity:0; transform:translateY(5px); animation:in .5s ease forwards; overflow-wrap:anywhere; }
  .ln + .ln { margin-top:10px; }
  .ln.u { color:var(--text); } .ln.u::before { content:"› "; color:var(--faint); }
  .ln.t { color:var(--faint); } .ln.t b { color:var(--text); font-weight:500; }
  .ln.ok { color:#15803d; }
  .ln.a { color:#2a2a30; font-family:var(--sans); font-size:14px; line-height:1.6; }
  .ln.a .c { color:var(--accent); font-family:var(--mono); font-size:12.5px; }
  .caret { display:inline-block; width:7px; height:15px; background:var(--text); vertical-align:-2px; animation:blink 1s steps(1) infinite; }
  .node { position:relative; height:100%; display:grid; place-items:center; }
  .node svg.path { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
  .node .track { stroke:var(--line2); stroke-width:1.5; stroke-dasharray:3 6; fill:none; }
  .node .glow { stroke:var(--accent); stroke-width:2; fill:none; stroke-dasharray:28 180; animation:flow 3.2s 1.6s linear infinite; stroke-dashoffset:0; opacity:0; }
  .chip { position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:14px 12px; border-radius:14px; background:#fff; border:1px solid var(--line2);
          box-shadow:var(--shadow); font:11px/1.35 var(--mono); color:var(--faint); text-align:center; }
  .chip b { color:var(--text); font:600 12px var(--sans); }
  @keyframes in { to { opacity:1; transform:none; } }
  @keyframes blink { 50% { opacity:0; } }
  @keyframes flow { 0% { stroke-dashoffset:0; opacity:1; } 100% { stroke-dashoffset:-208; opacity:1; } }

${HERO_CSS}

  /* works-with logos */
  .strip { border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:26px 0; }
  .strip .wrap { display:flex; align-items:center; gap:40px; flex-wrap:wrap; justify-content:center; }
  .strip .lab { font:11.5px var(--mono); text-transform:uppercase; letter-spacing:.12em; color:var(--faint); }
  .logo { display:inline-flex; align-items:center; gap:9px; font:500 15.5px var(--sans); color:#3f3f46; letter-spacing:-.01em; filter:grayscale(1); opacity:.78; transition:filter .2s, opacity .2s; }
  .logo:hover { filter:none; opacity:1; }

  section { padding:120px 0; position:relative; }
  .eyebrow { font:500 12px var(--mono); color:var(--faint); letter-spacing:.12em; text-transform:uppercase; margin:0 0 18px; }
  h2 { font-weight:500; font-size:clamp(32px, 4.2vw, 56px); line-height:1.04; letter-spacing:-.04em; margin:0 0 20px; max-width:880px; text-wrap:balance; }
  h2 .serif { font-style:italic; letter-spacing:-.015em; }
  .sub { color:var(--muted); font-size:18px; max-width:620px; margin:0 0 56px; line-height:1.6; }
  .ico { width:40px; height:40px; border-radius:11px; display:grid; place-items:center; background:var(--bg3); color:var(--text); flex:none; }
  .ico.blue { background:var(--accent-dim); color:var(--accent); }

  /* glue chips */
  .glue { display:grid; grid-template-columns:repeat(3, 1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .glue > div { background:#fff; padding:26px; display:grid; grid-template-columns:40px 1fr; gap:16px; align-items:start; }
  .glue b { display:block; font-weight:500; font-size:16.5px; letter-spacing:-.01em; margin:1px 0 4px; }
  .glue span:not(.ico) { color:var(--muted); font-size:14px; line-height:1.5; }
  .bridge { margin:28px 0 0; color:var(--muted); font-size:16px; display:flex; align-items:center; gap:10px; }
  .bridge svg { color:var(--accent); }
  .bridge b { color:var(--text); font-weight:500; }

  /* verbs */
  .verbs { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
  .verb { position:relative; border:1px solid var(--line); border-radius:16px; padding:30px; background:#fff; transition:border-color .2s, box-shadow .2s, transform .2s; }
  .verb:hover { border-color:var(--line2); box-shadow:var(--shadow); transform:translateY(-2px); }
  .verb h3 { font-family:var(--serif); font-style:italic; font-weight:400; font-size:50px; letter-spacing:-.02em; margin:18px 0 4px; line-height:1; }
  .verb .what { font:500 11.5px var(--mono); color:var(--muted); text-transform:uppercase; letter-spacing:.1em; margin-bottom:16px; }
  .verb p { color:var(--muted); margin:0 0 24px; }
  .say { font:13px/1.5 var(--mono); padding:10px 12px; border-radius:9px; background:var(--bg3); color:var(--text); }
  .say::before { content:"› "; color:var(--faint); }
  .verb .soon { position:absolute; top:30px; right:26px; font:11px var(--mono); color:var(--faint); border:1px dashed var(--line2); border-radius:99px; padding:2px 9px; }

  /* use cases: role filter + carousel */
  .cbar { display:flex; align-items:center; gap:16px; margin:-24px 0 28px; flex-wrap:wrap; }
  .roles { display:flex; flex-wrap:wrap; gap:8px; }
  .role { display:inline-flex; align-items:center; gap:7px; border:1px solid var(--line2); background:#fff; color:var(--muted); border-radius:99px; padding:7px 14px; font:500 13.5px var(--sans); cursor:pointer; }
  .role:hover { color:var(--text); }
  .role.on { background:var(--text); color:#fff; border-color:var(--text); }
  .arrows { display:flex; gap:8px; margin-left:auto; }
  .arrow { width:42px; height:42px; border-radius:50%; border:1px solid var(--line2); background:#fff; display:grid; place-items:center; cursor:pointer; color:var(--text); transition:border-color .15s, opacity .15s; }
  .arrow:hover { border-color:rgba(10,10,12,.35); }
  .arrow:disabled { opacity:.35; cursor:default; }
  .track { display:flex; gap:18px; overflow-x:auto; scroll-snap-type:x mandatory; scroll-behavior:smooth; padding:4px 2px 6px; scrollbar-width:none; overscroll-behavior-x:contain; }
  .track::-webkit-scrollbar { display:none; }
  .case { flex:0 0 calc((100% - 36px) / 3); scroll-snap-align:start; border:1px solid var(--line); border-radius:18px; background:#fff; overflow:hidden; display:flex; flex-direction:column; transition:box-shadow .2s, border-color .2s; }
  .case:hover { border-color:var(--line2); box-shadow:var(--shadow); }
  .case .bd { padding:20px 22px 22px; display:flex; flex-direction:column; gap:12px; flex:1; }
  .case .meta { display:flex; align-items:center; gap:10px; font:500 11.5px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  .case .meta .ico { width:30px; height:30px; border-radius:9px; }
  .case h3 { margin:0; font-size:19px; font-weight:500; letter-spacing:-.02em; line-height:1.25; }
  .ba { display:grid; gap:8px; font-size:14px; }
  .ba div { display:grid; grid-template-columns:52px 1fr; gap:10px; color:var(--muted); }
  .ba b { font:500 10.5px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.08em; padding-top:3px; }
  .ba .after { color:var(--text); } .ba .after b { color:#15803d; }
  .case .say { margin-top:auto; }
  .progress { height:2px; background:var(--line); border-radius:2px; margin-top:22px; overflow:hidden; }
  .progress i { display:block; height:100%; width:0; background:var(--text); border-radius:2px; transition:width .25s ease, margin-left .25s ease; }
  .art { position:relative; margin:0; aspect-ratio:16/10; background-color:var(--bg2); overflow:hidden; border-bottom:1px solid var(--line);
         background-image:radial-gradient(rgba(10,10,12,.09) 1px, transparent 1.2px); background-size:14px 14px; }
  .art .art-fb { position:absolute; inset:0; display:grid; place-items:center; color:var(--accent); opacity:.6; }
  .art .art-fb svg { width:44px; height:44px; padding:10px; box-sizing:content-box; background:#fff; border:1px solid var(--line2); border-radius:16px; }
  .art img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

  /* product shot */
  .shot { border:1px solid var(--line2); border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(10,10,12,.03), 0 40px 80px -40px rgba(10,10,12,.22); }
  .shot .chrome { display:flex; align-items:center; gap:8px; padding:11px 16px; border-bottom:1px solid var(--line); background:var(--bg2); }
  .shot .chrome i { width:10px; height:10px; border-radius:50%; background:#e4e4e7; }
  .shot .url { display:flex; align-items:center; gap:6px; margin-left:14px; flex:1; max-width:420px; font:12px var(--mono); color:var(--faint); background:#fff; border:1px solid var(--line); border-radius:7px; padding:4px 10px; }
  .app { display:grid; grid-template-columns:180px minmax(0, 1fr) 240px; min-height:430px; }
  .app .nav2 { border-right:1px solid var(--line); padding:18px 12px; font-size:13.5px; color:var(--muted); display:flex; flex-direction:column; gap:3px; background:var(--bg2); }
  .app .nav2 div { padding:7px 10px; border-radius:8px; display:flex; align-items:center; gap:9px; }
  .app .nav2 div .b { margin-left:auto; background:var(--accent); color:#fff; font:600 10px var(--mono); padding:1px 6px; border-radius:99px; }
  .app .nav2 .on { background:#fff; color:var(--text); box-shadow:0 1px 2px rgba(10,10,12,.06); }
  .app .main { padding:22px 24px; min-width:0; }
  .app .main h4 { margin:0 0 4px; font-size:19px; font-weight:500; letter-spacing:-.02em; }
  .app .main .m { display:flex; align-items:center; gap:6px; color:var(--faint); font-size:12.5px; margin-bottom:16px; }
  .ask { display:flex; gap:8px; margin-bottom:12px; }
  .ask div { flex:1; display:flex; align-items:center; gap:8px; border:1px solid var(--accent); border-radius:9px; padding:8px 12px; font-size:13px; box-shadow:0 0 0 4px var(--accent-dim); }
  .ask span { background:var(--text); color:#fff; font-weight:500; font-size:13px; border-radius:9px; padding:8px 12px; }
  .hits { font-size:12.5px; color:var(--muted); background:var(--accent-dim); border-radius:9px; padding:9px 12px; margin-bottom:14px; }
  .hits b { color:var(--accent); font-family:var(--mono); font-weight:500; margin-right:6px; }
  .st { display:grid; grid-template-columns:28px minmax(0, 1fr); gap:10px; font-size:13px; margin-bottom:8px; }
  .st .i { font:11px var(--mono); color:var(--faint); text-align:right; padding-top:7px; }
  .st .x { border-radius:9px; padding:7px 11px; overflow-wrap:anywhere; }
  .st.u .x { background:var(--bg3); font-weight:500; }
  .st.a .x { border:1px solid var(--line2); }
  .st.tl .x { font:12px var(--mono); color:var(--faint); padding:3px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .st.hit .x { outline:1.5px solid var(--accent); outline-offset:2px; }
  .app .side2 { border-left:1px solid var(--line); padding:18px; display:flex; flex-direction:column; gap:12px; font-size:12.5px; color:var(--muted); }
  .app .side2 .card2 { border:1px solid var(--line); border-radius:11px; padding:12px; }
  .app .side2 h5 { margin:0 0 9px; font:500 10.5px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.1em; }
  .fld { border:1px solid var(--line2); border-radius:7px; padding:6px 9px; color:var(--faint); margin-bottom:7px; }
  .bts { display:flex; gap:6px; } .bts span { border:1px solid var(--line2); border-radius:7px; padding:5px 10px; color:var(--text); } .bts span:first-child { background:var(--text); color:#fff; border-color:var(--text); }
  .live2 { display:inline-flex; align-items:center; gap:6px; color:#15803d; font:11px var(--mono); }
  .live2::before { content:""; width:6px; height:6px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.15); }

  /* features */
  .feats { display:grid; grid-template-columns:repeat(3, 1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .feat { background:#fff; padding:26px 26px 28px; position:relative; }
  .feat .ico { margin-bottom:18px; }
  .feat h3 { margin:0 0 6px; font-size:16.5px; font-weight:500; letter-spacing:-.01em; }
  .feat p { margin:0; color:var(--muted); font-size:14px; line-height:1.55; }
  .feat .s { position:absolute; top:30px; right:24px; font:11px var(--mono); color:#15803d; }
  .feat .s.todo { color:var(--faint); }

  /* comparison */
  .cmpwrap { overflow-x:auto; }
  .cmp { width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:16px; overflow:hidden; font-size:14.5px; }
  .cmp th, .cmp td { padding:15px 18px; text-align:left; border-bottom:1px solid var(--line); }
  .cmp tr:last-child td { border-bottom:0; }
  .cmp thead th { background:var(--bg2); font:500 12px var(--mono); color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .cmp thead th.us { color:var(--text); }
  .cmp thead th .h { display:inline-flex; align-items:center; gap:8px; }
  .cmp td:first-child { color:var(--text); font-weight:500; width:30%; }
  .cmp td { color:var(--muted); }
  .cmp td.us { background:var(--accent-dim); color:var(--text); font-weight:500; }
  .cmp .y { color:#15803d; font-weight:600; margin-right:6px; } .cmp .n { color:var(--faint); margin-right:6px; }

  /* integrations */
  .legend { display:flex; gap:22px; font:12px var(--mono); color:var(--muted); margin:-30px 0 40px; }
  .dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:8px; vertical-align:1px; }
  .dot.live { background:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.15); } .dot.todo { border:1px solid var(--faint); }
  .cgroups { display:grid; gap:34px; }
  .cgroup h4 { margin:0 0 14px; font:500 11.5px var(--mono); color:var(--faint); text-transform:uppercase; letter-spacing:.12em; }
  .cgrid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }
  .conn { border:1px solid var(--line); border-radius:14px; padding:18px; display:flex; flex-direction:column; gap:12px; min-height:156px; background:#fff; transition:border-color .2s, box-shadow .2s; }
  .conn:hover { border-color:var(--line2); box-shadow:var(--shadow); }
  .conn.soon { background:var(--bg2); border-style:dashed; }
  .conn .top { display:flex; align-items:center; gap:12px; }
  .conn .lg { width:40px; height:40px; border-radius:11px; display:grid; place-items:center; background:#fff; border:1px solid var(--line); flex:none; color:var(--text); }
  .conn.soon .lg { filter:grayscale(.4); }
  .conn b { font-weight:500; font-size:15px; letter-spacing:-.01em; }
  .conn p { margin:0; font-size:13.5px; color:var(--muted); line-height:1.5; }
  .conn .s { margin-top:auto; font:11.5px var(--mono); color:var(--faint); }
  .conn .s.live { color:#15803d; }

  /* permissions */
  .perm { display:grid; grid-template-columns:.95fr 1.05fr; gap:64px; align-items:center; }
  .panel { border:1px solid var(--line2); border-radius:16px; overflow:hidden; background:#fff; box-shadow:0 2px 4px rgba(10,10,12,.03), 0 40px 80px -40px rgba(10,10,12,.22); }
  .panel .hd { display:flex; align-items:center; gap:12px; padding:16px 18px; border-bottom:1px solid var(--line); background:var(--bg2); }
  .panel .hd .t { font-weight:500; } .panel .hd .s2 { color:var(--faint); font-size:12.5px; }
  .prow { display:grid; grid-template-columns:28px minmax(0, 1fr) auto; gap:12px; align-items:center; padding:12px 18px; border-bottom:1px solid var(--line); }
  .prow:last-child { border-bottom:0; }
  .prow .pi { width:28px; height:28px; border-radius:8px; border:1px solid var(--line); display:grid; place-items:center; color:var(--text); }
  .prow .a { font-size:14px; } .prow .a span { display:block; color:var(--faint); font-size:12px; }
  .tri { display:inline-flex; background:var(--bg3); border-radius:9px; padding:2px; gap:2px; }
  .tri i { font:500 12px var(--sans); font-style:normal; padding:5px 10px; border-radius:7px; color:var(--faint); }
  .tri i.on { background:#fff; box-shadow:0 1px 2px rgba(10,10,12,.1); }
  .tri i.on.allow { color:#15803d; } .tri i.on.ask { color:#b45309; } .tri i.on.deny { color:#b91c1c; }
  .bul { list-style:none; padding:0; margin:28px 0 0; display:grid; gap:14px; }
  .bul li { display:grid; grid-template-columns:22px 1fr; gap:10px; color:var(--muted); }
  .bul li svg { color:var(--accent); margin-top:3px; }
  .soon-tag { display:inline-flex; font:12px var(--mono); color:var(--muted); border:1px dashed var(--line2); border-radius:99px; padding:3px 11px; margin-bottom:22px; }

  /* trust */
  .trust { display:grid; grid-template-columns:repeat(4, 1fr); gap:1px; background:var(--line); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
  .trust > div { background:#fff; padding:28px; }
  .trust b { display:block; margin:16px 0 8px; font-weight:500; font-size:17px; }
  .trust span:not(.ico) { color:var(--muted); font-size:14px; }

  .final { padding:150px 0 130px; text-align:center; border-top:1px solid var(--line); background:linear-gradient(180deg, var(--bg2), #fff 60%); }
  .final h2 { margin:0 auto 18px; font-size:clamp(42px, 6.4vw, 88px); }
  .final .sub { margin:0 auto 44px; }
  footer { border-top:1px solid var(--line); padding:30px 0 44px; color:var(--faint); font-size:13.5px; }
  footer .wrap { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  footer a:hover { color:var(--text); }

  .reveal { opacity:0; transform:translateY(16px); transition:opacity .7s ease, transform .7s ease; }
  .reveal.seen { opacity:1; transform:none; }

  @media (max-width: 960px) {
    .relay { grid-template-columns:1fr; gap:0; }
    .node { height:100px; } .node svg.path { display:none; }
    .node::before { content:""; position:absolute; top:0; bottom:0; left:50%; border-left:1.5px dashed var(--line2); }
    .app { grid-template-columns:1fr; } .app .nav2, .app .side2 { display:none; }
    .verbs, .perm { grid-template-columns:1fr; } .glue, .feats { grid-template-columns:1fr 1fr; }
    .case { flex-basis:calc((100% - 18px) / 2); }
    .cgrid { grid-template-columns:1fr 1fr; } .trust { grid-template-columns:1fr 1fr; } .cmp { min-width:640px; }
    nav .links > a:not(.btn) { display:none; }
    section { padding:88px 0; } .hero { padding-top:118px; }
  }
  @media (max-width: 620px) {
    .glue, .feats, .cgrid, .trust { grid-template-columns:1fr; } .case { flex-basis:86%; }
    .wrap { padding:0 16px; } .verb { padding:24px; } .strip .wrap { gap:22px; } .arrows { display:none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ln, .reveal { animation:none !important; opacity:1 !important; transform:none !important; transition:none !important; }
    .node .glow { animation:none; opacity:0; } .caret { animation:none; } .track { scroll-behavior:auto; }
  }
</style>
</head>
<body>
<nav id="nav"><div class="wrap">
  <a class="brand" href="/">${LOGO}AnyDock</a>
  <div class="links"><a href="#how">How it works</a><a href="#cases">Use cases</a><a href="#features">Features</a><a href="#integrations">Integrations</a>${cta}</div>
</div></nav>

<header class="hero center"><div class="wrap">
  <span class="pill"><b>YC</b>Built for agents as the user</span>
  <h1>Agents made individuals&nbsp;10x.<br> <span class="serif">AnyDock</span> makes teams&nbsp;10x.</h1>
  <p class="lede">Share and hand over your agent's work — <em>context, trajectory, every decision</em> — to teammates and their agents. Across Claude Code, Codex and any MCP client.</p>
  ${installBox(prompt, cmd)}

  ${heroCarousel()}
</div></header>

<div class="strip"><div class="wrap"><span class="lab">Works with</span>
  <span class="logo">${brand("claude", 20)}Claude Code</span>
  <span class="logo">${logo("codex", 20)}Codex</span>
  <span class="logo">${brand("cursor", 20)}Cursor</span>
  <span class="logo">${brand("windsurf", 20)}Windsurf</span>
  <span class="logo">${logo("vscode", 20)}VS Code</span>
  <span class="logo">${brand("mcp", 20)}Any MCP client</span>
</div></div>

<section id="problem"><div class="wrap">
  <p class="eyebrow">The problem</p>
  <h2 class="reveal">Your agent got faster. <span class="serif">Your team didn't.</span></h2>
  <p class="sub reveal">Every agent session is an island, wired to its tools by hand. When the work crosses to another person, a human carries the context — and the access.</p>
  <div class="glue reveal">${GLUE.map(([icon, t, d]) => `<div><span class="ico">${line(icon, 19)}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join("")}</div>
  <p class="bridge reveal">${line("sparkles", 18)}<span>Each one is a person doing an agent's job: <b>carrying context.</b> AnyDock carries it instead.</span></p>
</div></section>

<section id="how" style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">Three verbs</p>
  <h2 class="reveal">Git for work, <span class="serif">not just code.</span></h2>
  <p class="sub reveal">AnyDock is the system of record for agent work. Every session keeps its context, trajectory and permissions — so anyone, or any agent, can pick it up.</p>
  <div class="verbs">
    <div class="verb reveal"><span class="ico blue">${line("arrow-left-right", 19)}</span><h3>share</h3><div class="what">Know-how out</div><p>Send a session to a teammate. Their agent reads it, replays the method, and asks why — answers cite the exact step.</p><div class="say">share this with jason@team.dev</div></div>
    <div class="verb reveal"><span class="ico blue">${line("repeat", 19)}</span><h3>handover</h3><div class="what">Work keeps going</div><p>Hand off mid-task. Context, progress and responsibility move together; new progress keeps syncing live.</p><div class="say">hand this over to ashley@team.dev</div></div>
    <div class="verb reveal"><span class="soon">in development</span><span class="ico blue">${line("key-round", 19)}</span><h3>delegate</h3><div class="what">Access in</div><p>Your agent acts inside your permissions — message, email, call — through a panel you control.</p><div class="say">tell #growth the report is ready</div></div>
  </div>
</div></section>

<section id="cases" style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">Use cases</p>
  <h2 class="reveal">Wherever work changes hands, <span class="serif">AnyDock carries it.</span></h2>
  <p class="sub reveal">The moments teams hit every week — and what they look like once agents can pick up each other's work, and its access.</p>
  <div class="cbar">
    <div class="roles" role="tablist">${roles.map((r, i) => `<button class="role${i === 0 ? " on" : ""}" data-role="${esc(r)}" type="button">${esc(r)}</button>`).join("")}</div>
    <div class="arrows"><button class="arrow" id="prev" type="button" aria-label="Previous"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
      <button class="arrow" id="next" type="button" aria-label="Next"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button></div>
  </div>
  <div class="track reveal" id="track">${CASES.map(caseHtml).join("")}</div>
  <div class="progress"><i id="bar"></i></div>
</div></section>

<section style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">See every decision</p>
  <h2 class="reveal">Ask why. <span class="serif">Get the receipts.</span></h2>
  <p class="sub reveal">Every shared work opens as a live, searchable trajectory. Ask a question and AnyDock jumps to the moments that answer it — no meeting, no "let me find that chat".</p>
  <div class="shot reveal">
    <div class="chrome"><i></i><i></i><i></i><span class="url">${line("lock", 12)}anydock.ai/app#/w/8ad4c541</span></div>
    <div class="app">
      <div class="nav2"><div class="on">${line("layers", 15)}Works</div><div>${line("inbox", 15)}Inbox <span class="b">2</span></div><div>${line("folder-kanban", 15)}Projects</div><div>${line("plug", 15)}Connections</div></div>
      <div class="main">
        <h4>Pick our hackathon tracks</h4><div class="m">${brand("claude", 13)}Nolan's Claude Code session · 412 steps · <span class="live2">live</span></div>
        <div class="ask"><div>${line("search", 14)}why Primitive over Blaxel?</div><span>Ask why</span></div>
        <div class="hits"><b>[2] [3] [4]</b>Sponsors: Armature, Blaxel, Inkbox, Insforge, Manufact, Primitive…</div>
        <div class="st u"><span class="i">0</span><div class="x">Survey the 8 sponsors and pick which prize tracks we should target.</div></div>
        <div class="st tl"><span class="i">1</span><div class="x">→ WebFetch {"url":"https://events.ycombinator.com/MakeSomethingAgentsWant"}</div></div>
        <div class="st tl hit"><span class="i">2</span><div class="x">← WebFetch Primitive: $3k / $2k / $1k cash · Blaxel: $1k · Stripe: $3k credits…</div></div>
        <div class="st a hit"><span class="i">3</span><div class="x">Target Primitive's track: most cash ($3k first place) and it fits agent-to-human communication.</div></div>
        <div class="st a hit"><span class="i">4</span><div class="x">Skip Blaxel for now: smaller prize and a weaker fit with handover.</div></div>
        <div class="st u"><span class="i">5</span><div class="x">Great — hand the ranking over to Jason when I log off.</div></div>
      </div>
      <div class="side2">
        <div class="card2"><h5>Hand over</h5><div class="fld">jason@team.dev</div><div class="bts"><span>Share</span><span>Hand over</span></div></div>
        <div class="card2"><h5>Project</h5>YC hackathon · 3 members</div>
        <div class="card2"><h5>Pick it up</h5><span style="font-family:var(--mono);color:var(--muted)">"read AnyDock work 8ad4c541 and continue it"</span></div>
      </div>
    </div>
  </div>
</div></section>

<section id="features" style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">Features</p>
  <h2 class="reveal">Everything a handover needs, <span class="serif">nothing it doesn't.</span></h2>
  <p class="sub reveal">What ships today — and what's landing next.</p>
  <div class="feats reveal">${FEATURES.map(([icon, title, body, live]) => `<div class="feat"><span class="s${live ? "" : " todo"}">${live ? "● Live" : "○ Soon"}</span><span class="ico">${line(icon, 19)}</span><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`).join("")}</div>
</div></section>

<section style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">Why it's different</p>
  <h2 class="reveal">Not multiplayer. <span class="serif">Relay.</span></h2>
  <p class="sub reveal">Everyone is building ways to watch each other's AI. Teams don't need to watch — they need to pick up where someone left off.</p>
  <div class="cmpwrap reveal"><table class="cmp">
    <thead><tr><th></th><th><span class="h">${line("file-text", 15)}Handover doc + meeting</span></th><th><span class="h">${line("users", 15)}"Multiplayer" AI</span></th><th class="us"><span class="h">${LOGO}AnyDock</span></th></tr></thead>
    <tbody>${COMPARE.map(([q, a, b, c]) => `<tr><td>${esc(q)}</td><td>${mark(a)}</td><td>${mark(b)}</td><td class="us">${mark(c)}</td></tr>`).join("")}</tbody>
  </table></div>
</div></section>

<section id="integrations"><div class="wrap">
  <p class="eyebrow">Integrations</p>
  <h2 class="reveal">One dock for every agent <span class="serif">and every tool.</span></h2>
  <p class="sub reveal">AnyDock owns the hard part — who did what, why, and who may touch it. Everything else plugs in: the agents you already use, the tools your work lives in, and the ways agents reach people.</p>
  <div class="legend"><span><i class="dot live"></i>Live today</span><span><i class="dot todo"></i>On the roadmap</span></div>
  <div class="cgroups">${CONNECTOR_GROUPS.map(groupHtml).join("")}</div>
</div></section>

<section style="padding-top:20px"><div class="wrap perm">
  <div class="reveal">
    <span class="soon-tag">delegate · in development</span>
    <h2>Your agent, <span class="serif">inside your permissions.</span></h2>
    <p class="sub" style="margin-bottom:0">Connect a tool once for the whole team. Each agent acts as the person it works for — never more — and every action is allowed, held for your OK, or blocked.</p>
    <ul class="bul">
      <li>${line("shield-check", 18)}<span>No more pasting tokens into agents, or setting up every SaaS for every agent.</span></li>
      <li>${line("users", 18)}<span>Permissions follow your org: an agent can never exceed its person.</span></li>
      <li>${line("undo-2", 18)}<span>Hand over the work and its access moves with it — and comes back on revoke.</span></li>
    </ul>
  </div>
  <div class="panel reveal" aria-label="Preview of the permission panel">
    <div class="hd">${logo("codex", 32)}<div><div class="t">Jason's Codex</div><div class="s2">acts for jason@team.dev · project YC hackathon</div></div></div>
    ${PERMISSIONS.map(([m, a, sub, v]) => `<div class="prow"><span class="pi">${markHtml(m, 15)}</span><div class="a">${a}<span>${sub}</span></div><div class="tri">${["allow", "ask", "deny"].map((x) => `<i class="${x}${x === v ? " on" : ""}">${x === "ask" ? "Ask me" : x[0]!.toUpperCase() + x.slice(1)}</i>`).join("")}</div></div>`).join("")}
  </div>
</div></section>

<section style="padding-top:20px"><div class="wrap">
  <p class="eyebrow">Private by default</p>
  <h2 class="reveal">Nothing leaves your machine <span class="serif">until you say so.</span></h2>
  <div class="trust reveal" style="margin-top:48px">
    <div><span class="ico">${line("lock", 19)}</span><b>Local first</b><span>Sessions are found on your machine. Only what you share or sync is uploaded.</span></div>
    <div><span class="ico">${line("eye-off", 19)}</span><b>Secrets scrubbed</b><span>API keys, tokens and private keys are redacted before anything leaves.</span></div>
    <div><span class="ico">${line("undo-2", 19)}</span><b>Revocable</b><span>Revoke a share and access is gone at once.</span></div>
    <div><span class="ico">${line("shuffle", 19)}</span><b>Vendor-neutral</b><span>Your team's context isn't locked inside one AI vendor.</span></div>
  </div>
</div></section>

<section class="final" id="install"><div class="wrap">
  <h2 class="reveal">The person leaves.<br><span class="serif">The work doesn't.</span></h2>
  <p class="sub">One prompt to set up. Plain words after that.</p>
  ${installBox(prompt, cmd)}
</div></section>

<footer><div class="wrap"><span>AnyDock · built at YC "Make Something Agents Want" · Oct 2026</span><span><a href="/login?next=/app">Sign in</a> &nbsp;·&nbsp; <a href="/agents.md">agents.md</a> &nbsp;·&nbsp; <a href="/install.sh">install.sh</a></span></div></footer>

<script>
document.querySelectorAll(".install").forEach((box) => {
  box.querySelectorAll(".tab").forEach((t) => t.onclick = () => {
    box.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
    box.querySelectorAll("[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
  });
});
document.querySelectorAll(".copy").forEach((b) => b.onclick = async () => {
  await navigator.clipboard.writeText(b.closest(".cmd").querySelector("code").textContent);
  const t = b.textContent; b.textContent = "Copied ✓"; setTimeout(() => b.textContent = t, 1400);
});

${HERO_JS}
// Use-case carousel: arrows, progress bar, role filter, gentle autoplay that stops once the visitor takes over.
(() => {
  const track = document.getElementById("track"), bar = document.getElementById("bar");
  const prev = document.getElementById("prev"), next = document.getElementById("next");
  const step = () => { const c = track.querySelector(".case:not([hidden])"); return c ? c.getBoundingClientRect().width + 18 : track.clientWidth; };
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const shown = Math.min(1, track.clientWidth / track.scrollWidth);
    bar.style.width = (shown * 100) + "%";
    bar.style.marginLeft = (max > 0 ? (track.scrollLeft / track.scrollWidth) * 100 : 0) + "%";
    prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft > max - 4;
  };
  const go = (dir) => track.scrollBy({ left: dir * step(), behavior: "smooth" });
  let auto = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : setInterval(() => {
    if (paused) return;
    const max = track.scrollWidth - track.clientWidth;
    track.scrollLeft > max - 4 ? track.scrollTo({ left: 0, behavior: "smooth" }) : go(1);
  }, 4500);
  let paused = false;
  const stop = () => { if (auto) { clearInterval(auto); auto = null; } };
  track.addEventListener("mouseenter", () => paused = true); track.addEventListener("mouseleave", () => paused = false);
  ["pointerdown", "wheel", "touchstart", "keydown"].forEach((e) => track.addEventListener(e, stop, { passive: true }));
  prev.onclick = () => { stop(); go(-1); }; next.onclick = () => { stop(); go(1); };
  track.addEventListener("scroll", update, { passive: true }); addEventListener("resize", update);
  document.querySelectorAll(".role").forEach((r) => r.onclick = () => {
    stop();
    document.querySelectorAll(".role").forEach((x) => x.classList.toggle("on", x === r));
    track.querySelectorAll(".case").forEach((c) => c.hidden = r.dataset.role !== "All" && c.dataset.role !== r.dataset.role);
    track.scrollTo({ left: 0 }); update();
  });
  update();
})();

const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", scrollY > 10);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); io.unobserve(e.target); } }), { threshold: 0.08 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
</script>
</body></html>`;
}

// ---------- content ----------

// Where people end up carrying context by hand.
const GLUE: [string, string, string][] = [
  ["clipboard-copy", "Copy-paste between tools", "Your agent can't see Slack, GitHub or the doc, so you ferry it in."],
  ["messages-square", "Re-explaining every time", "Each new session, each new teammate: start the story from zero."],
  ["file-text", "Handover docs nobody reads", "Half the reasons never make it into the note anyway."],
  ["circle-help", "“Where did this come from?”", "The agent read it three hours ago. Now nobody can find it."],
  ["presentation", "Teaching meetings", "An hour to show a colleague what your agent figured out."],
  ["moon", "Pinged after hours", "You logged off; the questions didn't."],
  ["plug", "Every person × agent × tool", "Each teammate wires Slack, GitHub and Notion into each agent, one by one."],
  ["key-round", "Tokens pasted into agents", "Personal API keys end up in prompts and config files IT can't see or revoke."],
  ["undo-2", "Access doesn't move with the work", "The new owner waits days for access; the old owner keeps it forever."],
];

type Case = { slug: string; icon: string; role: string; who: string; title: string; before: string; after: string; say: string };

// Each case has an illustration slot at /img/cases/<slug>.webp (see tasks/image-generation.md).
const CASES: Case[] = [
  { slug: "end-of-day", icon: "log-out", role: "Everyone", who: "end of day", title: "Log off without stopping the work",
    before: "Write a handover note nobody reads, then answer questions at 11pm.",
    after: "Say the word; the next person's agent picks up with every decision.", say: "hand this over to jason@team.dev" },
  { slug: "teaching", icon: "presentation", role: "Everyone", who: "know-how", title: "Replace the teaching meeting",
    before: "An hour-long call to show a colleague how you did it with your agent.",
    after: "Their agent replays your method on their task, in their own tools.", say: "do what Nolan did, for competitor C" },
  { slug: "on-call", icon: "siren", role: "Engineering", who: "on-call", title: "Hand off an incident at 3am",
    before: "The next on-call reads a 200-message thread and repeats your dead ends.",
    after: "They get what you tried, what failed and why — and keep going.", say: "hand this incident to the next on-call" },
  { slug: "code-review", icon: "git-pull-request", role: "Engineering", who: "code review", title: "Review the why behind a PR",
    before: "Reviewers guess why the agent chose this approach over the obvious one.",
    after: "The PR links its trajectory; ask why and get the step that decided it.", say: "why didn't we use a queue here?" },
  { slug: "spec-to-eng", icon: "file-text", role: "Product & Design", who: "spec → build", title: "Ship the spec with its reasoning",
    before: "Engineers build the literal spec and miss the trade-offs behind it.",
    after: "They read the research and decisions behind it, and ask the spec why.", say: "share the pricing research with eng" },
  { slug: "sales-to-cs", icon: "handshake", role: "Sales & CS", who: "deal → success", title: "Keep the promises made to customers",
    before: "“Your sales rep said that was coming” — and nobody knows what was promised.",
    after: "The account's whole agent history moves to CS with the handover.", say: "what did we promise Acme during the deal?" },
  { slug: "where-from", icon: "chart-column", role: "Leadership", who: "review", title: "“Where did this number come from?”",
    before: "Ping the author, wait a day, or re-check the whole report yourself.",
    after: "Ask the work. The answer cites the exact step and source behind it.", say: "why is churn 32% in this report?" },
  { slug: "follow-the-sun", icon: "globe", role: "Engineering", who: "time zones", title: "Follow-the-sun without the gaps",
    before: "Every overnight handoff loses a little context and half a day.",
    after: "Work syncs live; the next time zone starts exactly where you stopped.", say: "share today's progress with the Shanghai team" },
  { slug: "research", icon: "search", role: "Product & Design", who: "research", title: "Research once, reuse everywhere",
    before: "Marketing and product run nearly the same competitor research in one week.",
    after: "Works are searchable across the team, so the second person starts at step 400.", say: "has anyone researched Linear's pricing?" },
  { slug: "escalation", icon: "bug", role: "Sales & CS", who: "support → eng", title: "Escalate with the full story",
    before: "Engineering gets “customer says it's broken” and starts from scratch.",
    after: "They get the support agent's whole investigation, steps and logs included.", say: "escalate this to eng with everything we tried" },
  { slug: "orphan-agents", icon: "bot", role: "Leadership", who: "ownership", title: "No orphaned agents when someone leaves",
    before: "A long-running agent keeps emailing customers; nobody knows who set it up.",
    after: "Every agent has an owner; handing over the seat hands over its agents.", say: "who owns the follow-up agent for Acme?" },
  { slug: "access-handover", icon: "key-round", role: "Operations", who: "access", title: "Hand over the access with the work",
    before: "The new owner files six access requests; the person who left still has all of them.",
    after: "Scoped grants move with the handover and are revoked from the old owner automatically.", say: "hand this over to ashley — with the repo and channel access" },
  { slug: "connect-once", icon: "plug", role: "Operations", who: "IT · connectors", title: "Connect each tool once, for every agent",
    before: "Everyone wires every SaaS into every agent with personal tokens IT can't see.",
    after: "Connect Slack or GitHub once for the org; each agent inherits its person's access.", say: "connect our GitHub org for the whole team" },
  { slug: "onboarding", icon: "graduation-cap", role: "Operations", who: "onboarding", title: "Inherit context, not just files",
    before: "Weeks of archaeology through Notion pages and 300 Slack messages.",
    after: "A new hire reads the predecessor's works and asks why anything was done.", say: "what were the open questions on this project?" },
];

function caseHtml(c: Case): string {
  return `<article class="case" data-role="${esc(c.role)}">${art(`cases/${c.slug}.webp`, c.icon, c.title)}
    <div class="bd"><div class="meta"><span class="ico blue">${line(c.icon, 16)}</span>${esc(c.role)} · ${esc(c.who)}</div><h3>${esc(c.title)}</h3>
    <div class="ba"><div><b>Before</b><span>${esc(c.before)}</span></div><div class="after"><b>After</b><span>${esc(c.after)}</span></div></div>
    <div class="say">${esc(c.say)}</div></div></article>`;
}

const FEATURES: [string, string, string, boolean][] = [
  ["arrow-left-right", "Share & hand over in plain words", "Say it to your agent. AnyDock finds the session you're in, uploads it and notifies the person.", true],
  ["message-circle-question", "Ask why, with receipts", "Questions are answered from the trajectory, and every answer cites the step it came from.", true],
  ["refresh-cw", "Live sync", "Keep working after you share; teammates see new steps stream in within seconds.", true],
  ["shuffle", "Cross-vendor", "Start in Claude Code, continue in Codex or Cursor. One MCP server for every agent.", true],
  ["scroll-text", "Trajectory viewer", "Read any shared work in the browser: prompts, reasoning and tool calls, searchable.", true],
  ["inbox", "Inbox & live notifications", "Shares and handovers arrive instantly in the dashboard and in your agent.", true],
  ["folder-kanban", "Projects", "Team spaces: link works once and everyone in the project can read them.", true],
  ["shield-check", "Private by default", "Nothing uploads until you share; secrets are scrubbed first; revoke anytime.", true],
  ["zap", "One-prompt setup", "One prompt (or one command) installs, signs in, connects your agents and starts sync.", true],
  ["messages-square", "Discord", "Handover cards in your team's channel, and /anydock why right from Discord.", false],
  ["key-round", "Permission panel", "Allow, ask me or deny per action; approve from the dashboard, Slack, or right inside your agent.", true],
  ["repeat", "Method replay", "Turn a trajectory into a reusable playbook any teammate's agent can run.", false],
];

const COMPARE: [string, string, string, string][] = [
  ["Captures why, not just what", "n:Whatever someone remembers to write", "n:Only what's on screen now", "y:Every step, decision and source"],
  ["Works after the author logs off", "n:Until the first question", "n:Someone has to be watching", "y:Their agent keeps going"],
  ["Recipient's agent can continue", "n:Re-explain to it by hand", "n:Same vendor, same session", "y:Any agent, any vendor"],
  ["Answers cite their source", "n:—", "n:—", "y:Step-level citations"],
  ["Private by default", "y:It's your doc", "n:Shared live as you type", "y:Nothing leaves until you share"],
  ["Setup", "y:None, and it shows", "n:New tool for everyone", "y:One prompt"],
];

const mark = (v: string) => {
  const [k, t] = v.split(/:(.*)/s) as [string, string];
  return `<span class="${k === "y" ? "y" : "n"}">${k === "y" ? "✓" : "–"}</span>${esc(t)}`;
};

type Connector = { name: string; mark: Mark; what: string; live: boolean };

// Live = works today. Roadmap entries are on purpose: they show where AnyDock is going (several are hackathon sponsors).
const CONNECTOR_GROUPS: { title: string; items: Connector[] }[] = [
  {
    title: "Agents",
    items: [
      { name: "Claude Code", mark: { kind: "brand", k: "claude" }, what: "Captures sessions; share, hand over and ask why from inside the agent.", live: true },
      { name: "Codex", mark: { kind: "brand", k: "codex" }, what: "Same tools, different vendor — pick up a Claude Code handover in Codex.", live: true },
      { name: "Cursor, Windsurf, VS Code", mark: { kind: "brand", k: "cursor", color: "#0a0a0b" }, what: "Any MCP-capable editor connects to the same AnyDock MCP server.", live: true },
      { name: "Cloud sandboxes", mark: { kind: "line", k: "cloud" }, what: "Keep a handed-over agent running in a sandbox after you close your laptop.", live: false },
    ],
  },
  {
    title: "Reach people",
    items: [
      { name: "Discord", mark: { kind: "brand", k: "discord" }, what: "Post shares and handovers to a channel and ask why right from Discord.", live: false },
      { name: "Slack", mark: { kind: "brand", k: "slack" }, what: "Notify teammates on share and handover; agents read channels you can read.", live: false },
      { name: "Email", mark: { kind: "brand", k: "gmail" }, what: "Agents email people, wait for the reply and pick up attachments.", live: false },
      { name: "Phone & iMessage", mark: { kind: "brand", k: "apple", color: "#0a0a0b" }, what: "Text or call the person you handed work to when it needs them.", live: false },
    ],
  },
  {
    title: "Where work lives",
    items: [
      { name: "GitHub", mark: { kind: "brand", k: "github", color: "#0a0a0b" }, what: "Sign in today. Next: scoped repo access that moves with a handover.", live: true },
      { name: "Google", mark: { kind: "brand", k: "google" }, what: "Sign in today. Next: Drive files your agent can read, with your access.", live: true },
      { name: "Notion", mark: { kind: "brand", k: "notion", color: "#0a0a0b" }, what: "Bring docs and decisions into the trajectory your teammates read.", live: false },
      { name: "Linear", mark: { kind: "brand", k: "linear" }, what: "Link works to issues; a handover reassigns the issue too.", live: false },
    ],
  },
  {
    title: "Trust & spend",
    items: [
      { name: "Permission panel", mark: { kind: "line", k: "shield-check" }, what: "Allow, ask me, or deny — per action, with approvals and an activity log.", live: true },
      { name: "Stripe", mark: { kind: "brand", k: "stripe" }, what: "Budgets for agents: spend up to a limit, ask above it, revoke anytime.", live: false },
      { name: "Mac approvals", mark: { kind: "line", k: "lock" }, what: "Your own agent asks; you approve with Touch ID or your Mac password — never the agent.", live: true },
      { name: "Audit log", mark: { kind: "line", k: "scroll" }, what: "Every agent action, who approved it and where — in your activity log.", live: true },
    ],
  },
  {
    title: "Plugs into your SSO",
    items: [
      { name: "Okta", mark: { kind: "brand", k: "okta", color: "#0a0a0b" }, what: "Sign in with Okta; its groups become teams, so agent rules follow your org chart.", live: false },
      { name: "Microsoft Entra ID", mark: { kind: "brand", k: "microsoft" }, what: "Admin-consent Outlook and Teams once for a group — nobody clicks OAuth.", live: false },
      { name: "Google Workspace", mark: { kind: "brand", k: "google" }, what: "Domain-wide access for Gmail and Drive, scoped to the people AnyDock acts for.", live: false },
      { name: "SCIM directory sync", mark: { kind: "line", k: "users" }, what: "People, teams and managers sync in; someone leaves and their agents lose access.", live: false },
    ],
  },
];

const PERMISSIONS: [Mark, string, string, "allow" | "ask" | "deny"][] = [
  [{ kind: "brand", k: "slack" }, "Read #growth and #eng", "Slack · same channels Jason can read", "allow"],
  [{ kind: "brand", k: "discord" }, "Message teammates", "Slack · Discord", "allow"],
  [{ kind: "brand", k: "gmail" }, "Email someone outside the team", "Email", "ask"],
  [{ kind: "line", k: "phone" }, "Call or text a person", "Phone & iMessage", "ask"],
  [{ kind: "brand", k: "stripe" }, "Spend over $20", "Stripe", "ask"],
  [{ kind: "brand", k: "github", color: "#0a0a0b" }, "Push to main", "GitHub", "deny"],
];

function groupHtml(g: { title: string; items: Connector[] }): string {
  return `<div class="cgroup reveal"><h4>${esc(g.title)}</h4><div class="cgrid">${g.items
    .map(
      (c) => `<div class="conn${c.live ? "" : " soon"}"><div class="top"><span class="lg">${markHtml(c.mark, 22)}</span><b>${esc(c.name)}</b></div>
      <p>${esc(c.what)}</p><span class="s${c.live ? " live" : ""}">${c.live ? "● Live" : "○ Coming soon"}</span></div>`,
    )
    .join("")}</div></div>`;
}

function installBox(prompt: string, cmd: string): string {
  return `<div class="install">
    <div class="tabs" role="tablist"><button class="tab on" data-tab="agent" type="button">${line("sparkles", 14)}Ask your agent</button><button class="tab" data-tab="term" type="button">${line("terminal", 14)}Terminal</button></div>
    <div class="cmd" data-pane="agent"><span class="pr">›</span><code>${esc(prompt)}</code><button class="btn copy" type="button">Copy</button></div>
    <div class="cmd" data-pane="term" hidden><span class="pr">$</span><code>${esc(cmd)}</code><button class="btn copy" type="button">Copy</button></div>
  </div>
  <p class="fine"><span>${brand("claude", 13)}Claude Code</span><span>${logo("codex", 13)}Codex</span><span>${brand("cursor", 13, "#0a0a0b")}Cursor</span><span>· private until you share</span></p>`;
}
