// anydock.ai/ — the landing page. Server-rendered, no bundle; shares nothing with the auth card layout.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

export const LOGO = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="13" width="20" height="7" rx="2" fill="currentColor" opacity=".9"/><rect x="5" y="4" width="6" height="7" rx="1.5" fill="currentColor" opacity=".55"/><rect x="13" y="6" width="6" height="5" rx="1.5" fill="currentColor" opacity=".75"/></svg>`;

export function landingPage(opts: { signedIn: boolean; origin: string }): string {
  const prod = opts.origin === "https://anydock.ai";
  const cmd = prod ? "curl -fsSL https://anydock.ai/install.sh | sh" : `curl -fsSL ${opts.origin}/install.sh | ANYDOCK_SERVER=${opts.origin} sh`;
  const prompt = `Set up AnyDock for me: follow ${opts.origin}/agents.md`;
  const cta = opts.signedIn ? `<a class="btn solid" href="/app">Open dashboard</a>` : `<a class="btn" href="/login?next=/app">Sign in</a>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AnyDock — agent work your whole team can pick up</title>
<meta name="description" content="Share, hand over and explain agent work across people and agents. Works with Claude Code, Codex and any MCP client.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#f7f6f3; --fg:#17150f; --muted:#6b675e; --faint:#9a958a; --card:#ffffff; --line:#e6e2d9; --soft:#efece5;
    --accent:#4f46e5; --accent-soft:#eef0ff; --accent-fg:#ffffff; --ok:#15803d; --code:#1d1b16; --code-fg:#f3f1ea;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d0c0a; --fg:#f2f0ea; --muted:#a29d92; --faint:#76716a; --card:#16140f; --line:#29261f; --soft:#1d1a15;
            --accent:#8b85ff; --accent-soft:#1d1c33; --accent-fg:#0d0c0a; --ok:#4ade80; --code:#000; --code-fg:#f3f1ea; }
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-font-smoothing:antialiased; }
  a { color:inherit; }
  code, .mono { font-family:"JetBrains Mono", ui-monospace, monospace; }
  .wrap { max-width:1080px; margin:0 auto; padding:0 20px; }
  [hidden] { display:none !important; }

  nav { position:sticky; top:0; z-index:5; backdrop-filter:saturate(1.4) blur(10px); background:color-mix(in srgb, var(--bg) 82%, transparent); border-bottom:1px solid transparent; }
  nav.scrolled { border-bottom-color:var(--line); }
  nav .wrap { display:flex; align-items:center; gap:24px; height:60px; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:700; letter-spacing:-.02em; text-decoration:none; font-size:17px; }
  .brand svg { color:var(--accent); }
  nav .links { display:flex; gap:20px; margin-left:auto; font-size:14px; color:var(--muted); }
  nav .links a { text-decoration:none; } nav .links a:hover { color:var(--fg); }
  .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:9px; border:1px solid var(--line); background:var(--card);
         font:500 14px/1 Inter, system-ui, sans-serif; text-decoration:none; cursor:pointer; color:var(--fg); white-space:nowrap; }
  .btn:hover { border-color:var(--faint); }
  .btn.solid { background:var(--fg); color:var(--bg); border-color:var(--fg); }

  .hero { padding-top:72px; padding-bottom:40px; display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center; }
  .eyebrow { display:inline-flex; gap:8px; align-items:center; font-size:13px; color:var(--accent); background:var(--accent-soft); padding:4px 10px; border-radius:99px; font-weight:500; }
  h1 { font-size:clamp(36px, 5vw, 56px); line-height:1.04; letter-spacing:-.035em; margin:18px 0 18px; font-weight:700; }
  h1 .dim { color:var(--faint); }
  .lede { font-size:18px; color:var(--muted); margin:0 0 28px; max-width:520px; }

  .install { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:6px; max-width:540px; box-shadow:0 1px 0 rgba(0,0,0,.02), 0 12px 32px -18px rgba(0,0,0,.18); }
  .tabs { display:flex; gap:2px; padding:4px; }
  .tab { border:0; background:transparent; color:var(--muted); font:500 13px Inter, sans-serif; padding:6px 10px; border-radius:7px; cursor:pointer; }
  .tab.on { background:var(--soft); color:var(--fg); }
  .cmd { display:flex; align-items:center; gap:10px; padding:10px 8px 10px 14px; }
  .hero > *, .install, .cmd, .story, .perm > * { min-width:0; }
  .cmd code { flex:1; min-width:0; font-size:13.5px; overflow-x:auto; white-space:nowrap; scrollbar-width:none; }
  .cmd code::-webkit-scrollbar { display:none; }
  .copy { flex:none; }
  .fine { font-size:13px; color:var(--faint); margin:12px 2px 0; }

  /* the story card */
  .story { background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; box-shadow:0 30px 60px -30px rgba(20,16,8,.35); }
  .pane { padding:16px 18px; }
  .pane + .pane { border-top:1px dashed var(--line); }
  .who { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--faint); margin-bottom:10px; font-weight:500; }
  .dot { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; font-size:11px; font-weight:700; color:#fff; }
  .chip { font-size:11px; border:1px solid var(--line); border-radius:99px; padding:1px 8px; color:var(--muted); }
  .say { font-size:14.5px; margin:0 0 10px; }
  .say.user { background:var(--soft); border-radius:10px; padding:8px 12px; display:inline-block; }
  .tool { overflow-wrap:anywhere; font:12.5px/1.5 "JetBrains Mono", monospace; background:var(--code); color:var(--code-fg); border-radius:10px; padding:10px 12px; margin:0 0 10px; }
  .tool .k { color:#a5b4fc; } .tool .ok { color:#86efac; }
  .cite { color:var(--accent); font-weight:600; font-family:"JetBrains Mono", monospace; font-size:13px; }

  section { padding:72px 0; }
  .kicker { font-size:13px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--accent); margin:0 0 10px; }
  h2 { font-size:clamp(28px, 3.4vw, 40px); letter-spacing:-.03em; line-height:1.1; margin:0 0 16px; }
  .sub { color:var(--muted); font-size:17px; max-width:640px; margin:0 0 40px; }

  .pains { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .pain { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:24px; }
  .pain h3 { margin:0 0 8px; font-size:18px; letter-spacing:-.01em; }
  .pain p { margin:0; color:var(--muted); font-size:15px; }
  .pain .tag { display:inline-block; font:500 12px "JetBrains Mono", monospace; color:var(--accent); margin-bottom:12px; }
  .quote { margin:40px 0 0; font-size:22px; letter-spacing:-.01em; color:var(--muted); }
  .quote b { color:var(--fg); font-weight:600; }

  .verbs { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
  .verb { border-radius:14px; padding:24px; background:var(--card); border:1px solid var(--line); position:relative; }
  .verb .n { font:500 12px "JetBrains Mono", monospace; color:var(--faint); }
  .verb h3 { font-size:24px; margin:6px 0 4px; letter-spacing:-.02em; }
  .verb .what { color:var(--accent); font-weight:500; font-size:14px; margin-bottom:12px; }
  .verb p { color:var(--muted); font-size:15px; margin:0 0 14px; }
  .verb .ex { font:12.5px/1.5 "JetBrains Mono", monospace; background:var(--soft); border-radius:8px; padding:8px 10px; color:var(--fg); }

  .steps { display:grid; grid-template-columns:repeat(3, 1fr); gap:28px; counter-reset:s; }
  .step { border-top:2px solid var(--fg); padding-top:16px; }
  .step::before { counter-increment:s; content:"0" counter(s); font:500 13px "JetBrains Mono", monospace; color:var(--faint); }
  .step h3 { margin:6px 0 6px; font-size:18px; }
  .step p { margin:0; color:var(--muted); font-size:15px; }

  .works { display:flex; flex-wrap:wrap; gap:10px; margin-top:28px; }
  .works span { border:1px solid var(--line); background:var(--card); border-radius:99px; padding:6px 14px; font-size:14px; color:var(--muted); }

  .trust { display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; }
  .trust div { border-left:2px solid var(--line); padding-left:14px; }
  .trust b { display:block; margin-bottom:4px; }
  .trust span { color:var(--muted); font-size:14px; }

  /* connectors */
  .cgroups { display:grid; gap:28px; }
  .cgroup h4 { margin:0 0 12px; font-size:13px; font-weight:600; color:var(--faint); text-transform:uppercase; letter-spacing:.06em; }
  .cgrid { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; }
  .conn { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:8px; min-height:132px; }
  .conn.soon { background:transparent; border-style:dashed; }
  .conn .top { display:flex; align-items:center; gap:10px; }
  .conn .ic { width:30px; height:30px; border-radius:8px; display:grid; place-items:center; font:700 12px Inter, sans-serif; color:#fff; flex:none; }
  .conn b { font-size:14.5px; letter-spacing:-.01em; }
  .conn p { margin:0; font-size:13.5px; color:var(--muted); line-height:1.45; }
  .conn .st { margin-top:auto; font:500 11.5px "JetBrains Mono", monospace; }
  .st.live { color:var(--ok); } .st.live::before { content:"● "; }
  .st.todo { color:var(--faint); } .st.todo::before { content:"○ "; }
  .legend { display:flex; gap:16px; font:500 12.5px "JetBrains Mono", monospace; margin:-24px 0 32px; }

  /* permission panel preview */
  .perm { display:grid; grid-template-columns:.9fr 1.1fr; gap:40px; align-items:center; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:16px; overflow:hidden; box-shadow:0 30px 60px -36px rgba(20,16,8,.35); }
  .panel .hd { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--line); }
  .panel .hd .t { font-weight:600; } .panel .hd .s { color:var(--faint); font-size:13px; }
  .prow { display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; padding:11px 16px; border-bottom:1px solid var(--line); }
  .prow:last-child { border-bottom:0; }
  .prow .a { font-size:14px; } .prow .a span { display:block; color:var(--faint); font-size:12px; }
  .tri { display:inline-flex; background:var(--soft); border-radius:8px; padding:2px; gap:2px; }
  .tri i { font:500 12px Inter, sans-serif; font-style:normal; padding:4px 9px; border-radius:6px; color:var(--faint); }
  .tri i.on.allow { background:var(--ok); color:#fff; } .tri i.on.ask { background:#d97706; color:#fff; } .tri i.on.deny { background:#b91c1c; color:#fff; }
  .soon-tag { display:inline-block; font:500 11.5px "JetBrains Mono", monospace; color:var(--faint); border:1px dashed var(--line); border-radius:99px; padding:2px 10px; margin-bottom:14px; }
  .bul { list-style:none; padding:0; margin:20px 0 0; display:grid; gap:10px; }
  .bul li { padding-left:22px; position:relative; color:var(--muted); }
  .bul li::before { content:"→"; position:absolute; left:0; color:var(--accent); }

  .hero-bg { position:absolute; inset:0 0 auto 0; height:720px; z-index:-1; pointer-events:none;
             background:radial-gradient(60% 50% at 75% 20%, var(--accent-soft), transparent 70%), radial-gradient(40% 40% at 10% 0%, color-mix(in srgb, #d97706 10%, transparent), transparent 70%); }

  .final { text-align:center; padding:96px 0 80px; }
  .final h2 { font-size:clamp(32px, 4.6vw, 52px); }
  .final .install { margin:28px auto 0; text-align:left; }
  footer { border-top:1px solid var(--line); padding:28px 0 40px; color:var(--faint); font-size:14px; }
  footer .wrap { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }

  @media (max-width: 860px) {
    .hero { grid-template-columns:1fr; padding-top:40px; gap:36px; }
    h1 br { display:none; }
    .pains, .verbs, .steps, .perm { grid-template-columns:1fr; }
    .cgrid { grid-template-columns:1fr 1fr; }
    .trust { grid-template-columns:1fr 1fr; }
    nav .links a:not(.btn) { display:none; }
  }
</style>
</head>
<body>
<div class="hero-bg"></div>
<nav id="nav"><div class="wrap">
  <a class="brand" href="/">${LOGO}AnyDock</a>
  <div class="links"><a href="#why">Why</a><a href="#how">How it works</a><a href="#connectors">Connectors</a><a href="#install">Install</a>${cta}</div>
</div></nav>

<header class="wrap hero">
  <div>
    <span class="eyebrow">Built for agents as the user</span>
    <h1>Agents made individuals 10x.<br> <span class="dim">AnyDock makes teams 10x.</span></h1>
    <p class="lede">Share and hand over your agent's work — context, trajectory, every decision — to teammates and <em>their</em> agents. Claude Code, Codex, or any MCP client.</p>
    ${installBox(prompt, cmd)}
  </div>

  <div class="story" aria-label="Example: a handover from Claude Code to Codex">
    <div class="pane">
      <div class="who"><span class="dot" style="background:#d97706">N</span>Nolan <span class="chip">Claude Code</span></div>
      <p class="say user">I'm heading out — hand this over to jason@team.dev</p>
      <div class="tool"><span class="k">anydock_handover</span> → <span class="ok">Handed over</span> "Pick our hackathon tracks" · 412 steps</div>
    </div>
    <div class="pane">
      <div class="who"><span class="dot" style="background:#0891b2">J</span>Jason <span class="chip">Codex</span> <span class="chip">a different vendor</span></div>
      <p class="say user">Why did Nolan pick Primitive's track over Blaxel?</p>
      <div class="tool"><span class="k">anydock_ask_why</span> → 6 relevant moments from Nolan's session</div>
      <p class="say">Primitive pays the most cash ($3k first place) and fits agent-to-human communication <span class="cite">[3]</span>. Blaxel was skipped: smaller prize, weaker fit with handover <span class="cite">[4]</span>.</p>
    </div>
  </div>
</header>

<section id="why"><div class="wrap">
  <p class="kicker">The problem</p>
  <h2>Your agent got faster. Your team didn't.</h2>
  <p class="sub">Every agent session is an island. The context, the dead ends, the reasons behind each decision — they vanish when the session closes, and you become the glue.</p>
  <div class="pains">
    <div class="pain"><span class="tag">access in</span><h3>You're the copy-paste layer</h3><p>Your agent can't see Slack, GitHub or the doc your teammate wrote, so you shuttle context between tools and agents all day.</p></div>
    <div class="pain"><span class="tag">know-how out</span><h3>You teach it twice</h3><p>You figure something out with your agent, then book a meeting to teach a colleague — who goes and re-teaches their own agent.</p></div>
  </div>
  <p class="quote">"At my internship I spent all day copy-pasting between Slack and Claude. <b>Am I the agent, or is it?</b>"</p>
</div></section>

<section id="how"><div class="wrap">
  <p class="kicker">Three verbs</p>
  <h2>Git for work, not just code.</h2>
  <p class="sub">AnyDock is the system of record for agent work. Every session keeps its context, trajectory and permissions — so anyone, or any agent, can pick it up.</p>
  <div class="verbs">
    <div class="verb"><span class="n">01</span><h3>share</h3><div class="what">Know-how out</div><p>Send a session to a teammate. Their agent can read it, replay the method, and ask why — with the answer cited to the step.</p><div class="ex">"share this with jason@team.dev"</div></div>
    <div class="verb"><span class="n">02</span><h3>handover</h3><div class="what">Work keeps going</div><p>Hand off mid-task. Context, progress and responsibility move together, and new progress keeps syncing live.</p><div class="ex">"hand this over to ashley@team.dev"</div></div>
    <div class="verb"><span class="n">03</span><h3>delegate</h3><div class="what">Access in</div><p>Your agent acts inside your permissions — message, email, call — gated by a panel you control: allow, ask me, or deny.</p><div class="ex">"tell #growth the report is ready"</div></div>
  </div>
  <p class="quote"><b>The meeting that never happened.</b> Stop teaching people — teach their agents.</p>
</div></section>

<section><div class="wrap">
  <p class="kicker">How it works</p>
  <h2>One prompt to set up. Plain words after that.</h2>
  <div class="steps">
    <div class="step"><h3>Install in one line</h3><p>Paste one prompt into your agent, or one command into a terminal. It signs you in, connects Claude Code and Codex, and starts background sync.</p></div>
    <div class="step"><h3>Share by asking</h3><p>Say "share this with…" or "hand this over to…". AnyDock picks the session you're in, uploads it, and notifies them.</p></div>
    <div class="step"><h3>They pick it up</h3><p>Your teammate's agent — any vendor — reads the trajectory, asks why, and carries on. You stay offline.</p></div>
  </div>
  <div class="works"><span>Claude Code</span><span>Codex</span><span>Cursor</span><span>Any MCP client</span><span>macOS · Linux</span></div>
</div></section>

<section id="connectors"><div class="wrap">
  <p class="kicker">Connectors</p>
  <h2>One place your team's agents plug into.</h2>
  <p class="sub">AnyDock owns the hard part — who did what, why, and who may touch it. Everything else plugs in: the agents you already use, the tools your work lives in, and the ways agents reach people.</p>
  <div class="legend"><span class="st live">Live today</span><span class="st todo">On the roadmap</span></div>
  <div class="cgroups">${CONNECTOR_GROUPS.map(groupHtml).join("")}</div>
</div></section>

<section><div class="wrap perm">
  <div>
    <span class="soon-tag">delegate · in development</span>
    <h2>Your agent, inside your permissions.</h2>
    <p class="sub" style="margin-bottom:0">Connect a tool once for the whole team. Each agent then acts as the person it works for — never more — and every action is allowed, held for your OK, or blocked.</p>
    <ul class="bul">
      <li>No more pasting tokens into agents, or configuring every SaaS for every agent.</li>
      <li>Permissions flow from your org: an agent can never exceed the person it works for.</li>
      <li>Hand over the work and its access moves with it — and comes back on revoke.</li>
    </ul>
  </div>
  <div class="panel" aria-label="Preview of the permission panel">
    <div class="hd"><span class="ic" style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:#0f766e;color:#fff;font:700 11px Inter">CX</span>
      <div><div class="t">Jason's Codex</div><div class="s">acts for jason@team.dev · project YC hackathon</div></div></div>
    ${PERMISSIONS.map(([a, sub, v]) => `<div class="prow"><div class="a">${a}<span>${sub}</span></div><div class="tri">${["allow", "ask", "deny"].map((x) => `<i class="${x}${x === v ? " on" : ""}">${x === "ask" ? "Ask me" : x[0]!.toUpperCase() + x.slice(1)}</i>`).join("")}</div></div>`).join("")}
  </div>
</div></section>

<section><div class="wrap">
  <p class="kicker">Private by default</p>
  <h2>Nothing leaves your machine until you say so.</h2>
  <div class="trust" style="margin-top:28px">
    <div><b>Local first</b><span>Sessions are discovered locally; only what you share or sync is uploaded.</span></div>
    <div><b>Secrets scrubbed</b><span>API keys, tokens and private keys are redacted before upload.</span></div>
    <div><b>Revocable</b><span>Revoke a share and access is gone at once.</span></div>
    <div><b>Vendor-neutral</b><span>Your team's context isn't locked inside one AI vendor.</span></div>
  </div>
</div></section>

<section class="final" id="install"><div class="wrap">
  <h2>The person leaves.<br>The work doesn't.</h2>
  ${installBox(prompt, cmd)}
</div></section>

<footer><div class="wrap"><span>AnyDock · built at YC "Make Something Agents Want" · Oct 2026</span><span><a href="/login?next=/app">Sign in</a> · <a href="/agents.md">agents.md</a></span></div></footer>

<script>
document.querySelectorAll(".install").forEach((box) => {
  box.querySelectorAll(".tab").forEach((t) => t.onclick = () => {
    box.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === t));
    box.querySelectorAll("[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
  });
});
document.querySelectorAll(".copy").forEach((b) => b.onclick = async () => {
  await navigator.clipboard.writeText(b.previousElementSibling.textContent);
  const t = b.textContent; b.textContent = "Copied"; setTimeout(() => b.textContent = t, 1400);
});
const nav = document.getElementById("nav");
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 8), { passive: true });
</script>
</body></html>`;
}

type Connector = { name: string; mark: string; color: string; what: string; live: boolean };

// Live = works today. Roadmap entries are on purpose: they show where AnyDock is going (several are hackathon sponsors).
const CONNECTOR_GROUPS: { title: string; items: Connector[] }[] = [
  {
    title: "Agents",
    items: [
      { name: "Claude Code", mark: "CC", color: "#c2410c", what: "Captures sessions; share, hand over and ask why from inside the agent.", live: true },
      { name: "Codex", mark: "CX", color: "#0f766e", what: "Same tools, different vendor — pick up a Claude Code handover in Codex.", live: true },
      { name: "Any MCP client", mark: "MCP", color: "#334155", what: "Cursor, Windsurf, VS Code and others connect to the same AnyDock MCP server.", live: true },
      { name: "Cloud sandboxes", mark: "BX", color: "#7c3aed", what: "Keep a handed-over agent running in a sandbox after you close your laptop.", live: false },
    ],
  },
  {
    title: "Reach people",
    items: [
      { name: "Slack", mark: "SL", color: "#4a154b", what: "Notify teammates on share and handover; agents read channels you can read.", live: false },
      { name: "Discord", mark: "DC", color: "#5865f2", what: "Post shares and handovers to a channel and ask why right from Discord.", live: false },
      { name: "Email", mark: "@", color: "#0e7490", what: "Agents email people, wait for the reply and pick up attachments (Primitive).", live: false },
      { name: "Phone & iMessage", mark: "☎", color: "#15803d", what: "Text or call the person you handed work to when it needs them (Inkbox).", live: false },
    ],
  },
  {
    title: "Where work lives",
    items: [
      { name: "GitHub", mark: "GH", color: "#24292f", what: "Sign in today. Next: scoped repo access that moves with a handover.", live: true },
      { name: "Notion", mark: "N", color: "#111111", what: "Bring docs and decisions into the trajectory your teammates read.", live: false },
      { name: "Linear", mark: "LN", color: "#5e6ad2", what: "Link works to issues; a handover reassigns the issue too.", live: false },
      { name: "Google Drive", mark: "GD", color: "#1a73e8", what: "Sign in with Google today. Next: files your agent can read, with your access.", live: true },
    ],
  },
  {
    title: "Trust & spend",
    items: [
      { name: "Permission panel", mark: "✓", color: "#4f46e5", what: "Allow, ask me, or deny — per agent, per action.", live: false },
      { name: "Stripe", mark: "$", color: "#635bff", what: "Budgets for agents: spend up to a limit, ask above it, revoke anytime.", live: false },
      { name: "Okta / SSO", mark: "SSO", color: "#0b5cff", what: "Org-wide identity, so agent permissions follow your directory.", live: false },
      { name: "Audit log", mark: "≡", color: "#57534e", what: "Who shared what, which agent did what, and why — exportable.", live: false },
    ],
  },
];

const PERMISSIONS: [string, string, "allow" | "ask" | "deny"][] = [
  ["Read #growth and #eng", "Slack · same channels Jason can read", "allow"],
  ["Message teammates", "Slack · Discord", "allow"],
  ["Email someone outside the team", "Email", "ask"],
  ["Call or text a person", "Phone & iMessage", "ask"],
  ["Spend over $20", "Stripe", "ask"],
  ["Push to main", "GitHub", "deny"],
];

function groupHtml(g: { title: string; items: Connector[] }): string {
  return `<div class="cgroup"><h4>${esc(g.title)}</h4><div class="cgrid">${g.items
    .map(
      (c) => `<div class="conn${c.live ? "" : " soon"}"><div class="top"><span class="ic" style="background:${c.color}">${esc(c.mark)}</span><b>${esc(c.name)}</b></div>
      <p>${esc(c.what)}</p><span class="st ${c.live ? "live" : "todo"}">${c.live ? "Live" : "Coming soon"}</span></div>`,
    )
    .join("")}</div></div>`;
}

function installBox(prompt: string, cmd: string): string {
  return `<div class="install">
    <div class="tabs" role="tablist"><button class="tab on" data-tab="agent" type="button">Ask your agent</button><button class="tab" data-tab="term" type="button">Terminal</button></div>
    <div class="cmd" data-pane="agent"><code>${esc(prompt)}</code><button class="btn copy" type="button">Copy</button></div>
    <div class="cmd" data-pane="term" hidden><code>${esc(cmd)}</code><button class="btn copy" type="button">Copy</button></div>
  </div>
  <p class="fine">Works in Claude Code, Codex, Cursor. Needs Node 22+. Private until you share.</p>`;
}
