// Hero carousel for the landing page: five scenes, each with its own staged animation.
// Any element with data-t="<seconds>" gets the class "in" that long after its slide becomes active;
// CSS decides what "in" looks like (fade, fly, fill, draw, strike…). Slides auto-advance; tabs/arrows take over.
import { line, logo } from "./icons.ts";

// Avatar: a generated portrait at /img/avatars/<name>.webp when it exists (tasks/image-generation.md), else the initial.
const PEOPLE: Record<string, string> = { N: "nolan", J: "jason", M: "mei", K: "kai", A: "ashley", L: "lead" };
const av = (letter: string, color: string, size = 28) =>
  `<span class="h-av" style="width:${size}px;height:${size}px;background:${color};font-size:${Math.round(size * 0.4)}px">${letter}${
    PEOPLE[letter] ? `<img src="/img/avatars/${PEOPLE[letter]}.webp" alt="" loading="lazy" onerror="this.remove()">` : ""
  }</span>`;

type Slide = { key: string; tab: string; icon: string; title: string; body: string; say: string; stage: string };

const SLIDES: Slide[] = [
  {
    key: "trace",
    tab: "Trace a report",
    icon: "chart-column",
    title: "Someone made a report. You ask how.",
    body: "Mei's agent built the churn report. Her lead asks where 32% came from — and gets the exact export, filter and reasoning behind it, without waking Mei up.",
    say: "how did Mei get 32% churn?",
    stage: `
      <div class="st-trace">
        <div class="doc" data-t="0">
          <div class="doc-h">${av("M", "#7c3aed", 24)}<div><b>Q3 churn report</b><small>Mei · ${logo("claude", 11)} Claude Code · 2h ago</small></div></div>
          <div class="kpis">
            <div class="kpi hot"><small>Churn</small><b>32%</b><span class="ring" data-t="1.1"></span></div>
            <div class="kpi"><small>Paid accounts</small><b>1,284</b></div>
          </div>
          <div class="bars">${[38, 52, 44, 61, 47, 70, 58].map((h, i) => `<i style="height:${h}%" class="${i === 5 ? "hl" : ""}"></i>`).join("")}</div>
          <div class="txt"><i></i><i></i><i style="width:62%"></i></div>
        </div>
        <div class="side">
          <div class="q" data-t="1.6">${av("L", "#0a0a0b", 24)}<div><small>Lead · ${logo("codex", 11)} Codex</small><span>How did Mei get <b>32%</b>?</span></div></div>
          <div class="trail">
            <span class="rail" data-t="2.3"></span>
            <div class="src" data-t="2.6"><em>[118]</em>${line("scroll", 14)}<div><b>Stripe export</b><small>September cohort</small></div></div>
            <div class="src" data-t="3.2"><em>[121]</em>${line("search", 14)}<div><b>Paid plans only</b><small>1,284 accounts</small></div></div>
            <div class="src" data-t="3.8"><em>[123]</em>${line("eye-off", 14)}<div><b>Trials excluded</b><small>they churn by design</small></div></div>
          </div>
          <div class="a" data-t="4.6">411 of 1,284 paid accounts churned in September → <b>32.0%</b> <span class="cites">[118] [121] [123]</span></div>
        </div>
      </div>`,
  },
  {
    key: "handover",
    tab: "Hand over",
    icon: "repeat",
    title: "Log off. The work keeps going.",
    body: "Nolan hands his half-finished session to Jason. Context, decisions and access travel together — and Jason's agent, in a different tool, continues from the same step.",
    say: "hand this over to jason@team.dev",
    stage: `
      <div class="st-hand">
        <div class="desk me">
          <div class="who">${av("N", "#d97757", 26)}<div><b>Nolan</b><small class="status"><span class="on-s">● online</span><span class="off-s" data-t="2.6">${line("moon", 11)} offline</span></small></div></div>
          <div class="screen">
            <div class="app-h">${logo("claude", 12)} Claude Code</div>
            <b>Pick our hackathon tracks</b>
            <div class="prog"><i style="width:68%"></i></div><small>step 412 · 6 of 8 sponsors ranked</small>
          </div>
          <div class="bub" data-t="0.5">hand this over to Jason</div>
        </div>
        <div class="lane">
          <div class="baton" data-t="1.3">
            <b>${line("layers", 13)} Pick our hackathon tracks</b>
            <div class="chips"><span>context</span><span>trajectory</span><span>access</span></div>
          </div>
          <span class="dash"></span>
        </div>
        <div class="desk them">
          <div class="who">${av("J", "#10a37f", 26)}<div><b>Jason</b><small class="status"><span class="on-s">● online</span></small></div></div>
          <div class="screen dim" data-t="2.9">
            <div class="app-h">${logo("codex", 12)} Codex</div>
            <b>Pick our hackathon tracks</b>
            <div class="prog"><i class="grow"></i></div><small>continuing from step 412</small>
          </div>
          <div class="bub" data-t="3.9">Got it — finishing Stripe and Supabase next.</div>
        </div>
      </div>`,
  },
  {
    key: "status",
    tab: "Team status",
    icon: "layers",
    title: "Stand-up, without the meeting.",
    body: "Ask what the team is working on and get it from their live work — what each agent is doing, who's blocked, and on what.",
    say: "what's everyone on Launch doing right now?",
    stage: `
      <div class="st-status">
        <div class="sq" data-t="0">${av("A", "#2b59ff", 24)}<span>what's everyone on <b>Launch</b> doing?</span><small>${logo("cursor", 11)} Cursor</small></div>
        <div class="team">
          ${[
            ["N", "#d97757", "Nolan", "Pricing research", "212 steps", "claude", "live"],
            ["J", "#10a37f", "Jason", "Landing copy", "handed over 1h ago", "codex", ""],
            ["M", "#7c3aed", "Mei", "Churn report", "waiting on Stripe data", "claude", "blocked"],
            ["K", "#0e7490", "Kai", "Onboarding emails", "38 steps", "cursor", "live"],
          ]
            .map(
              ([l, c, n, w, m, h, s], i) => `<div class="mate ${s}" data-t="${(0.8 + i * 0.5).toFixed(1)}">${av(l!, c!, 30)}<div><b>${n}</b><span>${w}</span><small>${logo(h!, 11)} ${m}</small></div><i class="pulse"></i></div>`,
            )
            .join("")}
        </div>
        <div class="sum" data-t="3.2">${line("sparkles", 14)} 4 people · 2 agents live · <b>Mei is blocked on the Stripe export</b></div>
      </div>`,
  },
  {
    key: "delegate",
    tab: "Message for me",
    icon: "messages-square",
    title: "Your agent reaches people — with your permissions.",
    body: "Ask once; your agent posts in Slack and drafts the email. Slack is allowed. Email to outside the team waits for your OK. (delegate · preview)",
    say: "tell Jason in Slack, and email the summary to the team",
    stage: `
      <div class="st-del">
        <div class="col">
          <div class="pbox">
            <div class="ph">${logo("claude", 13)} Nolan's agent · permissions</div>
            <div class="pr" data-t="0.6">${logo("slack", 15)}<span>Post in #hackathon</span><em class="ok">Allowed</em></div>
            <div class="pr" data-t="1.0">${logo("gmail", 15)}<span>Email team@team.dev</span><em class="ask">Ask me</em></div>
            <div class="pr" data-t="1.4">${logo("github", 15, "#0a0a0b")}<span>Push to main</span><em class="no">Denied</em></div>
          </div>
          <div class="approve" data-t="2.8"><b>${line("shield-check", 14)} Send email to team@team.dev?</b><div class="bt"><span>Deny</span><span class="yes" data-t="3.6">Approve</span></div></div>
        </div>
        <div class="col">
          <div class="slack" data-t="1.8">
            <div class="sh">${logo("slack", 13)} #hackathon</div>
            <div class="sm">${av("N", "#d97757", 22)}<div><b>Nolan's agent</b> <small>now</small><br>@Jason the sponsor ranking is ready — Primitive first, Stripe second.</div></div>
          </div>
          <div class="mail" data-t="4.1">
            <div class="mh">${logo("gmail", 13)} to team@team.dev <em data-t="4.4">${line("shield-check", 11)} sent</em></div>
            <b>Sponsor ranking: summary</b><span>Primitive ($3k) and Stripe ($3k credits) are our tracks. Sources are linked in the work.</span>
          </div>
        </div>
      </div>`,
  },
  {
    key: "meeting",
    tab: "Skip the meeting",
    icon: "presentation",
    title: "Teach their agent, not the person.",
    body: "Instead of an hour on a call, Jason's agent replays Nolan's method on a new problem — same steps, same checks, his own tools.",
    say: "do what Nolan did, for competitor C",
    stage: `
      <div class="st-meet">
        <div class="cal" data-t="0"><div class="ct">${line("presentation", 14)} Tue 3:00 – 4:00 PM</div><b class="ttl">Teach Jason the research flow<span class="strike" data-t="0.8"></span></b><em data-t="1.2">Cancelled — not needed</em></div>
        <div class="pair">
          <div class="book">
            <div class="bh">${av("N", "#d97757", 22)} Nolan's method <small>last week · competitor A</small></div>
            ${["Pull pricing pages", "Compare plan limits", "Check G2 reviews", "Score fit vs. us"].map((s) => `<div class="stp done">${line("shield-check", 13)}${s}</div>`).join("")}
          </div>
          <div class="arrow-x" data-t="1.7">${line("repeat", 18)}</div>
          <div class="book run">
            <div class="bh">${av("J", "#10a37f", 22)} Jason's agent <small>${logo("codex", 11)} now · competitor C</small></div>
            ${["Pull pricing pages", "Compare plan limits", "Check G2 reviews", "Score fit vs. us"].map((s, i) => `<div class="stp" data-t="${(2.2 + i * 0.7).toFixed(1)}">${line("shield-check", 13)}${s}</div>`).join("")}
          </div>
        </div>
      </div>`,
  },
  {
    key: "onboard",
    tab: "Onboard",
    icon: "graduation-cap",
    title: "Day one, with the keys and the context.",
    body: "Kai takes over Priya's seat. The access her role needs is granted in one go — anything sensitive asks a human — and her past work comes with it, so Kai's agent can ask what was still open.",
    say: "what were Priya's open questions on growth?",
    stage: `
      <div class="st-onb">
        <div class="seat" data-t="0">
          <div class="sh2">${av("K", "#0e7490", 30)}<div><b>Welcome, Kai</b><small>Growth · Priya's seat</small></div></div>
          ${[
            ["github", "growth-site repo", "granted", 0.7],
            ["slack", "#growth, #launch", "granted", 1.1],
            ["notion", "Growth wiki", "granted", 1.5],
            ["stripe", "Stripe dashboard", "approved by Nolan", 2.1],
          ]
            .map(([k, n, st, t]) => `<div class="g" data-t="${t}">${logo(k as string, 15, k === "github" || k === "notion" ? "#0a0a0b" : undefined)}<span>${n}</span><em class="${k === "stripe" ? "ap" : ""}">${line("shield-check", 11)} ${st}</em></div>`)
            .join("")}
        </div>
        <div class="ctx">
          <div class="ch" data-t="2.6">${line("layers", 14)} Context from Priya · 3 works</div>
          <div class="w" data-t="2.9"><b>EU pricing test</b><small>212 steps · paused</small></div>
          <div class="w" data-t="3.2"><b>Vendor contract review</b><small>340 steps</small></div>
          <div class="w" data-t="3.5"><b>Q4 channel plan</b><small>96 steps</small></div>
          <div class="kq" data-t="4.1">${logo("claude", 12)} The EU pricing test never got a winner <em>[212]</em>, and the vendor contract renews Nov 1 <em>[340]</em>.</div>
        </div>
      </div>`,
  },
  {
    key: "connect",
    tab: "Connect once",
    icon: "plug",
    title: "Connect each tool once — not per person, per agent.",
    body: "An admin connects Slack, GitHub, Notion and Linear for the whole team. Every agent then acts as the person it works for, with exactly their access — no personal tokens pasted into prompts.",
    say: "connect our GitHub org for the whole team",
    stage: `
      <div class="st-conn">
        <div class="tok" data-t="0"><span>Personal tokens pasted into agents</span><b class="was">47</b><b class="now" data-t="3.6">0</b></div>
        <div class="net">
          <div class="tools">${["slack", "github", "notion", "linear"].map((k, i) => `<div class="tl" data-t="${(0.4 + i * 0.25).toFixed(2)}">${logo(k, 18, k === "github" || k === "notion" ? "#0a0a0b" : undefined)}</div>`).join("")}</div>
          <div class="wire l" data-t="1.6"></div>
          <div class="hub" data-t="1.3">${line("plug", 18)}<b>AnyDock</b><small>team · connected once</small></div>
          <div class="wire r" data-t="2.2"></div>
          <div class="agents">
            ${[
              ["claude", "Nolan", "his repos & channels"],
              ["codex", "Jason", "his repos & channels"],
              ["cursor", "Ashley", "read-only on billing"],
            ]
              .map(([k, n, sc], i) => `<div class="ag" data-t="${(2.5 + i * 0.3).toFixed(1)}">${logo(k!, 15, k === "cursor" ? "#0a0a0b" : undefined)}<div><b>acts as ${n}</b><small>${sc}</small></div></div>`)
              .join("")}
          </div>
        </div>
        <div class="rule" data-t="4.2">${line("shield-check", 14)} An agent can never exceed its person. Revoke the person, and every agent loses it too.</div>
      </div>`,
  },
  {
    key: "keys",
    tab: "Pass the keys",
    icon: "key-round",
    title: "Access moves with the work — and leaves with the person.",
    body: "Nolan is moving teams. Handing over Launch moves exactly the grants that work needs to Ashley, revokes them from Nolan, and writes it to the audit log. No tickets, no forgotten access.",
    say: "hand Launch over to ashley — with its access",
    stage: `
      <div class="st-keys">
        <div class="pp">
          <div class="who2">${av("N", "#d97757", 26)}<div><b>Nolan</b><small>moving teams</small></div></div>
          ${[["github", "launch-site repo"], ["slack", "#launch"], ["notion", "Launch plan"], ["stripe", "Billing (read)"]]
            .map(([k, n], i) => `<div class="k from"><span class="kx">${logo(k!, 14, k === "github" || k === "notion" ? "#0a0a0b" : undefined)}${n}</span><i class="cut" data-t="${(0.9 + i * 0.5).toFixed(1)}"></i><em data-t="${(1.0 + i * 0.5).toFixed(1)}">revoked</em></div>`)
            .join("")}
        </div>
        <div class="mid" data-t="0.4">${line("key-round", 18)}</div>
        <div class="pp">
          <div class="who2">${av("A", "#2b59ff", 26)}<div><b>Ashley</b><small>taking over Launch · scoped grants</small></div></div>
          ${[["github", "launch-site repo"], ["slack", "#launch"], ["notion", "Launch plan"], ["stripe", "Billing (read)"]]
            .map(([k, n], i) => `<div class="k to" data-t="${(1.2 + i * 0.5).toFixed(1)}"><span class="kx">${logo(k!, 14, k === "github" || k === "notion" ? "#0a0a0b" : undefined)}${n}</span><em>granted</em></div>`)
            .join("")}
        </div>
        <div class="audit" data-t="3.6">${line("scroll", 13)} <span>18:02</span> Launch handed over Nolan → Ashley · 4 grants moved · 4 revoked</div>
      </div>`,
  },
];

export function heroCarousel(): string {
  return `<div class="hc" id="hc">
    <div class="hc-tabs" role="tablist">${SLIDES.map((s, i) => `<button class="hc-tab${i === 0 ? " on" : ""}" role="tab" type="button" data-i="${i}">${line(s.icon, 15)}<span>${s.tab}</span><i></i></button>`).join("")}</div>
    <div class="hc-view"><div class="hc-track" id="hcTrack">${SLIDES.map(
      (s, i) => `<section class="hc-slide" data-key="${s.key}" aria-hidden="${i === 0 ? "false" : "true"}">
        <div class="hc-copy"><span class="hc-n">0${i + 1} / 0${SLIDES.length}</span><h3>${s.title}</h3><p>${s.body}</p><div class="hc-say">${line("sparkles", 13)}<span>${s.say}</span></div></div>
        <div class="hc-stage">${s.stage}</div>
      </section>`,
    ).join("")}</div></div>
    <div class="hc-nav"><button class="hc-arrow" id="hcPrev" type="button" aria-label="Previous scene"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
      <div class="hc-dots">${SLIDES.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>
      <button class="hc-arrow" id="hcNext" type="button" aria-label="Next scene"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></button></div>
  </div>`;
}

export const HERO_CSS = `
  .hc { margin:64px auto 0; max-width:1120px; text-align:left; }
  .hc-tabs { display:flex; flex-wrap:wrap; justify-content:center; gap:2px; width:max-content; max-width:100%; margin:0 auto 26px; padding:4px; border:1px solid var(--line2); border-radius:999px; background:#fff; box-shadow:var(--shadow); }
  .hc-tab { position:relative; overflow:hidden; display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; color:var(--muted); font:500 13px var(--sans); padding:7px 11px; border-radius:999px; cursor:pointer; }
  .hc-tab:hover { color:var(--text); }
  .hc-tab.on { background:var(--text); color:#fff; }
  .hc-tab i { position:absolute; left:14px; right:14px; bottom:4px; height:2px; border-radius:2px; background:rgba(255,255,255,.4); transform-origin:left; transform:scaleX(0); }
  .hc-tab.on.play i { animation:hcfill var(--hcdur) linear forwards; }
  @keyframes hcfill { to { transform:scaleX(1); } }
  .hc-view { overflow:hidden; border:1px solid var(--line2); border-radius:22px; background:linear-gradient(180deg, #fff, var(--bg2)); box-shadow:0 2px 4px rgba(10,10,12,.03), 0 50px 100px -50px rgba(10,10,12,.28); }
  .hc-track { display:flex; transition:transform .7s cubic-bezier(.6,.05,.25,1); }
  .hc-slide { flex:0 0 100%; display:grid; grid-template-columns:minmax(0, .8fr) minmax(0, 1.2fr); gap:28px; padding:40px; min-height:470px; align-items:center; }
  .hc-n { font:500 12px var(--mono); color:var(--faint); letter-spacing:.06em; }
  .hc-copy h3 { font-size:clamp(24px, 2.6vw, 32px); font-weight:500; letter-spacing:-.03em; line-height:1.12; margin:12px 0 14px; }
  .hc-copy p { color:var(--muted); margin:0 0 20px; font-size:15.5px; line-height:1.6; }
  .hc-say { display:inline-flex; align-items:center; gap:8px; font:13px var(--mono); padding:9px 12px; border-radius:10px; background:var(--bg3); color:var(--text); }
  .hc-say svg { color:var(--accent); }
  .hc-stage { position:relative; min-height:390px; display:grid; align-items:center; }
  .hc-nav { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:20px; }
  .hc-arrow { width:38px; height:38px; border-radius:50%; border:1px solid var(--line2); background:#fff; display:grid; place-items:center; cursor:pointer; color:var(--text); }
  .hc-arrow:hover { border-color:rgba(10,10,12,.35); }
  .hc-dots { display:flex; gap:7px; } .hc-dots i { width:7px; height:7px; border-radius:99px; background:var(--line2); transition:width .3s, background .3s; }
  .hc-dots i.on { width:22px; background:var(--text); }

  /* shared pieces */
  .hc .h-av { position:relative; display:inline-grid !important; place-items:center; border-radius:50%; overflow:hidden; color:#fff !important; font-family:var(--sans); font-weight:600; line-height:1; margin:0 !important; padding:0 !important; flex:none; }
  .hc .h-av img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .hc [data-t] { opacity:0; transform:translateY(10px); transition:opacity .5s ease, transform .55s cubic-bezier(.2,.8,.2,1); }
  .hc [data-t].in { opacity:1; transform:none; }
  .card-w { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); }
  .hc small { color:var(--faint); font:11.5px var(--mono); display:inline-flex; align-items:center; gap:5px; }

  /* 1. trace a report */
  .st-trace { display:grid; grid-template-columns:1.05fr 1fr; gap:18px; align-items:center; }
  .st-trace .doc { background:#fff; border:1px solid var(--line2); border-radius:16px; box-shadow:var(--shadow); padding:18px; }
  .st-trace .doc-h { display:flex; gap:10px; align-items:center; margin-bottom:16px; }
  .st-trace .doc-h b { display:block; font-weight:600; font-size:15px; letter-spacing:-.01em; }
  .st-trace .kpis { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
  .st-trace .kpi { position:relative; border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
  .st-trace .kpi b { display:block; font-size:28px; font-weight:600; letter-spacing:-.03em; line-height:1.15; }
  .st-trace .kpi.hot b { color:var(--accent); }
  .st-trace .ring { position:absolute; inset:-5px; border:2px solid var(--accent); border-radius:15px; box-shadow:0 0 0 6px rgba(43,89,255,.1); }
  .st-trace .ring[data-t] { transform:scale(1.12); }
  .st-trace .ring.in { transform:none; }
  .st-trace .bars { display:flex; align-items:end; gap:7px; height:86px; padding:8px 4px 0; border-bottom:1px solid var(--line); margin-bottom:14px; }
  .st-trace .bars i { flex:1; background:#e4e4e7; border-radius:5px 5px 0 0; } .st-trace .bars i.hl { background:var(--accent); }
  .st-trace .txt i { display:block; height:7px; border-radius:4px; background:var(--bg3); margin-bottom:7px; }
  .st-trace .side { display:flex; flex-direction:column; gap:12px; }
  .st-trace .q, .st-trace .a { display:flex; gap:10px; align-items:flex-start; background:#fff; border:1px solid var(--line2); border-radius:14px; padding:11px 13px; font-size:14px; box-shadow:var(--shadow); }
  .st-trace .q small { display:flex; margin-bottom:2px; }
  .st-trace .q div { display:flex; flex-direction:column; }
  .st-trace .trail { position:relative; display:flex; flex-direction:column; gap:8px; padding-left:18px; }
  .st-trace .rail { position:absolute; left:6px; top:6px; bottom:6px; width:2px; background:var(--accent); border-radius:2px; transform-origin:top; }
  .st-trace .rail[data-t] { transform:scaleY(0); opacity:1; } .st-trace .rail.in { transform:scaleY(1); transition:transform 1.6s ease; }
  .st-trace .src { position:relative; display:grid; grid-template-columns:44px 18px 1fr; gap:8px; align-items:center; font-size:13.5px; background:var(--accent-dim); border-radius:11px; padding:8px 10px; }
  .st-trace .src::before { content:""; position:absolute; left:-16px; top:50%; width:8px; height:8px; margin-top:-4px; border-radius:50%; background:#fff; border:2px solid var(--accent); }
  .st-trace .src em { font:500 12px var(--mono); color:var(--accent); font-style:normal; }
  .st-trace .src svg { color:var(--accent); }
  .st-trace .src b { font-weight:500; display:block; line-height:1.2; }
  .st-trace .a { background:var(--text); color:#fff; border-color:var(--text); display:block; }
  .st-trace .a b { color:#a5b4fc; } .st-trace .a .cites { font:12px var(--mono); color:#a1a1aa; margin-left:4px; }

  /* 2. hand over */
  .st-hand { display:grid; grid-template-columns:1fr 150px 1fr; align-items:center; gap:6px; }
  .st-hand .desk { position:relative; display:flex; flex-direction:column; gap:10px; }
  .st-hand .who { display:flex; gap:9px; align-items:center; } .st-hand .who b { display:block; font-weight:500; font-size:14px; }
  .st-hand .status { position:relative; } .st-hand .on-s { color:#15803d; }
  .st-hand .off-s { position:absolute; left:0; top:0; background:var(--bg2); color:var(--muted); padding-right:4px; display:inline-flex; gap:4px; align-items:center; white-space:nowrap; }
  .st-hand .screen { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); padding:14px; font-size:14px; transition:opacity .6s, filter .6s; }
  .st-hand .me .screen { animation:none; }
  .st-hand .screen .app-h { display:flex; align-items:center; gap:6px; font:11.5px var(--mono); color:var(--faint); margin-bottom:8px; }
  .st-hand .screen b { display:block; font-weight:500; margin-bottom:10px; }
  .st-hand .prog { height:6px; border-radius:6px; background:var(--bg3); overflow:hidden; margin-bottom:6px; }
  .st-hand .prog i { display:block; height:100%; background:var(--accent); border-radius:6px; }
  .st-hand .prog i.grow { width:68%; transition:width 2.4s ease .6s; }
  .st-hand .screen.dim[data-t] { opacity:.35; transform:none; filter:grayscale(1); }
  .st-hand .screen.dim.in { opacity:1; filter:none; }
  .st-hand .screen.dim.in .prog i.grow { width:84%; }
  .st-hand .bub { align-self:flex-start; background:var(--text); color:#fff; font-size:13.5px; padding:8px 12px; border-radius:12px 12px 12px 4px; max-width:92%; }
  .st-hand .them .bub { align-self:flex-end; border-radius:12px 12px 4px 12px; background:var(--accent); }
  .st-hand .lane { position:relative; height:100%; min-height:120px; display:grid; place-items:center; }
  .st-hand .dash { position:absolute; left:0; right:0; top:50%; border-top:1.5px dashed var(--line2); z-index:0; }
  .st-hand .baton { position:relative; z-index:1; width:170px; background:#fff; border:1.5px solid var(--accent); border-radius:13px; padding:9px 11px; box-shadow:0 10px 30px -10px rgba(43,89,255,.45); font-size:12px; }
  .st-hand .baton b { display:flex; gap:5px; align-items:center; font-weight:500; margin-bottom:6px; color:var(--text); }
  .st-hand .baton .chips { display:flex; flex-wrap:wrap; gap:4px; } .st-hand .baton .chips span { font:10.5px var(--mono); color:var(--accent); background:var(--accent-dim); border-radius:99px; padding:1px 7px; }
  .st-hand .baton[data-t] { opacity:1; transform:translateX(-120%) scale(.85); }
  .st-hand .baton.in { animation:fly 1.6s cubic-bezier(.5,0,.2,1) forwards; }
  @keyframes fly { 0% { transform:translateX(-120%) scale(.85); } 45% { transform:translateX(0) translateY(-18px) scale(1); } 100% { transform:translateX(120%) scale(.85); opacity:.0; } }

  /* 3. status */
  .st-status { display:flex; flex-direction:column; gap:14px; }
  .st-status .sq { display:flex; align-items:center; gap:10px; align-self:flex-start; background:#fff; border:1px solid var(--line2); border-radius:999px; padding:6px 14px 6px 6px; box-shadow:var(--shadow); font-size:14px; }
  .st-status .team { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .st-status .mate { position:relative; display:flex; gap:11px; align-items:flex-start; background:#fff; border:1px solid var(--line2); border-radius:14px; padding:13px; box-shadow:var(--shadow); }
  .st-status .mate b { display:block; font-weight:500; font-size:14px; } .st-status .mate span { display:block; font-size:13.5px; color:var(--muted); margin:1px 0 4px; }
  .st-status .pulse { position:absolute; top:14px; right:14px; width:8px; height:8px; border-radius:50%; background:var(--faint); }
  .st-status .mate.live .pulse { background:#16a34a; box-shadow:0 0 0 0 rgba(22,163,74,.5); animation:pulse 1.8s infinite; }
  .st-status .mate.blocked { border-color:#fcd34d; } .st-status .mate.blocked .pulse { background:#f59e0b; }
  @keyframes pulse { 70% { box-shadow:0 0 0 8px rgba(22,163,74,0); } 100% { box-shadow:0 0 0 0 rgba(22,163,74,0); } }
  .st-status .sum { display:flex; align-items:center; gap:8px; background:var(--text); color:#fff; border-radius:12px; padding:11px 14px; font-size:14px; }
  .st-status .sum svg { color:#a5b4fc; } .st-status .sum b { font-weight:500; color:#fde68a; }

  /* 4. delegate */
  .st-del { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
  .st-del .col { display:flex; flex-direction:column; gap:12px; }
  .st-del .pbox { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); overflow:hidden; }
  .st-del .ph { display:flex; gap:7px; align-items:center; padding:10px 13px; font:11.5px var(--mono); color:var(--muted); background:var(--bg2); border-bottom:1px solid var(--line); }
  .st-del .pr { display:grid; grid-template-columns:18px 1fr auto; gap:9px; align-items:center; padding:10px 13px; border-bottom:1px solid var(--line); font-size:13.5px; }
  .st-del .pr:last-child { border-bottom:0; }
  .st-del .pr em { font:500 11.5px var(--sans); font-style:normal; padding:3px 9px; border-radius:99px; }
  .st-del em.ok { color:#15803d; background:#e8f6ec; } .st-del em.ask { color:#b45309; background:#fdf3e4; } .st-del em.no { color:#b91c1c; background:#fdecec; }
  .st-del .approve { background:#fff; border:1.5px solid #f5b84a; border-radius:14px; padding:12px 13px; box-shadow:0 12px 30px -14px rgba(180,83,9,.4); font-size:13.5px; }
  .st-del .approve b { display:flex; gap:7px; align-items:center; font-weight:500; margin-bottom:10px; }
  .st-del .bt { display:flex; gap:8px; } .st-del .bt span { flex:1; text-align:center; border:1px solid var(--line2); border-radius:9px; padding:6px; font-size:13px; }
  .st-del .bt .yes[data-t] { opacity:1; transform:none; background:#fff; transition:background .25s, color .25s, box-shadow .25s; }
  .st-del .bt .yes.in { background:var(--text); color:#fff; box-shadow:0 0 0 4px rgba(10,10,12,.12); }
  .st-del .slack, .st-del .mail { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); padding:12px 13px; font-size:13.5px; }
  .st-del .sh, .st-del .mh { display:flex; gap:7px; align-items:center; font:11.5px var(--mono); color:var(--muted); margin-bottom:9px; }
  .st-del .sm { display:grid; grid-template-columns:22px 1fr; gap:9px; line-height:1.5; } .st-del .sm b { font-weight:600; }
  .st-del .mail b { display:block; font-weight:600; margin-bottom:3px; } .st-del .mail span { color:var(--muted); }
  .st-del .mh em { margin-left:auto; display:inline-flex; gap:4px; align-items:center; color:#15803d; font-style:normal; }

  /* 5. skip the meeting */
  .st-meet { display:flex; flex-direction:column; gap:16px; }
  .st-meet .cal { position:relative; align-self:flex-start; background:#fff; border:1px solid var(--line2); border-left:4px solid var(--accent); border-radius:12px; padding:10px 14px; box-shadow:var(--shadow); font-size:14px; min-width:280px; }
  .st-meet .cal .ct { display:flex; gap:6px; align-items:center; font:11.5px var(--mono); color:var(--faint); margin-bottom:3px; }
  .st-meet .cal .ttl { position:relative; display:inline-block; font-weight:500; transition:color .4s ease .2s; }
  .st-meet .strike { position:absolute; left:-2px; right:-2px; top:52%; height:2px; margin-top:-1px; background:#b91c1c; border-radius:2px; transform-origin:left; }
  .st-meet .cal:has(.strike.in) .ttl { color:var(--faint); }
  .st-meet .cal .ct { transition:opacity .4s ease .2s; } .st-meet .cal:has(.strike.in) .ct { opacity:.5; }
  .st-meet .cal { transition:border-color .4s ease .2s; } .st-meet .cal:has(.strike.in) { border-left-color:var(--line2); }
  .st-meet .strike[data-t] { opacity:1; transform:scaleX(0); } .st-meet .strike.in { transform:scaleX(1); transition:transform .5s ease; }
  .st-meet .cal em { display:block; font:500 12px var(--sans); font-style:normal; color:#b91c1c; margin-top:4px; }
  .st-meet .pair { display:grid; grid-template-columns:1fr 40px 1fr; gap:8px; align-items:center; }
  .st-meet .book { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); padding:12px; }
  .st-meet .book.run { border-color:rgba(43,89,255,.45); }
  .st-meet .bh { display:flex; gap:8px; align-items:center; font-size:13.5px; font-weight:500; margin-bottom:9px; flex-wrap:wrap; }
  .st-meet .bh small { width:100%; margin-left:30px; margin-top:-6px; }
  .st-meet .stp { display:flex; gap:8px; align-items:center; font-size:13.5px; padding:7px 9px; border-radius:9px; color:var(--muted); }
  .st-meet .stp svg { color:var(--faint); }
  .st-meet .stp.done svg { color:#15803d; }
  .st-meet .run .stp[data-t] { opacity:.35; transform:none; }
  .st-meet .run .stp.in { opacity:1; background:var(--accent-dim); color:var(--text); }
  .st-meet .run .stp.in svg { color:var(--accent); }
  .st-meet .arrow-x { display:grid; place-items:center; width:40px; height:40px; border-radius:50%; background:var(--text); color:#fff; }

  /* 6. onboarding */
  .st-onb { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
  .st-onb .seat, .st-onb .ctx { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); padding:13px; display:flex; flex-direction:column; gap:8px; }
  .st-onb .sh2 { display:flex; gap:10px; align-items:center; margin-bottom:4px; } .st-onb .sh2 b { display:block; font-weight:600; }
  .st-onb .g { display:grid; grid-template-columns:18px 1fr auto; gap:8px; align-items:center; font-size:13.5px; padding:7px 9px; border-radius:10px; background:var(--bg2); }
  .st-onb .g em { display:inline-flex; gap:4px; align-items:center; font:500 11px var(--sans); font-style:normal; color:#15803d; background:#e8f6ec; border-radius:99px; padding:2px 8px; }
  .st-onb .g em.ap { color:#b45309; background:#fdf3e4; }
  .st-onb .ch { display:flex; gap:7px; align-items:center; font:11.5px var(--mono); color:var(--muted); }
  .st-onb .w { border:1px solid var(--line); border-radius:10px; padding:8px 10px; font-size:13.5px; display:flex; justify-content:space-between; gap:8px; align-items:center; }
  .st-onb .w b { font-weight:500; }
  .st-onb .kq { display:block; background:var(--text); color:#fff; border-radius:12px; padding:10px 12px; font-size:13.5px; line-height:1.5; }
  .st-onb .kq svg { vertical-align:-2px; margin-right:4px; } .st-onb .kq em { font:12px var(--mono); font-style:normal; color:#a5b4fc; }

  /* 7. connect once */
  .st-conn { display:flex; flex-direction:column; gap:16px; }
  .st-conn .tok { position:relative; align-self:flex-start; display:flex; gap:12px; align-items:center; background:#fff; border:1px solid var(--line2); border-radius:999px; padding:6px 8px 6px 14px; font-size:13.5px; box-shadow:var(--shadow); }
  .st-conn .tok b { font:600 15px var(--mono); padding:2px 10px; border-radius:99px; min-width:46px; text-align:center; transition:opacity .35s ease, transform .35s ease; }
  .st-conn .tok:has(.now.in) .was { opacity:0; transform:scale(.6); }
  .st-conn .tok .was { color:#b91c1c; background:#fdecec; } .st-conn .tok .now { position:absolute; right:8px; color:#15803d; background:#e8f6ec; }
  .st-conn .tok .now[data-t] { transform:scale(.6); } .st-conn .tok .now.in { transform:none; }
  .st-conn .net { display:grid; grid-template-columns:auto 1fr auto 1fr auto; align-items:center; gap:0; }
  .st-conn .tools { display:flex; flex-direction:column; gap:8px; }
  .st-conn .tl { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:#fff; border:1px solid var(--line2); box-shadow:var(--shadow); }
  .st-conn .wire { height:2px; margin:0 6px; background:repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 11px); transform-origin:left; }
  .st-conn .wire[data-t] { opacity:1; transform:scaleX(0); } .st-conn .wire.in { transform:scaleX(1); transition:transform .7s ease; }
  .st-conn .hub { display:flex; flex-direction:column; align-items:center; gap:4px; padding:14px 16px; border-radius:16px; background:#fff; border:1.5px solid var(--accent); box-shadow:0 0 0 6px var(--accent-dim), var(--shadow); text-align:center; color:var(--accent); }
  .st-conn .hub b { color:var(--text); font-weight:600; font-size:14px; }
  .st-conn .agents { display:flex; flex-direction:column; gap:8px; }
  .st-conn .ag { display:flex; gap:9px; align-items:center; background:#fff; border:1px solid var(--line2); border-radius:12px; padding:8px 11px; box-shadow:var(--shadow); font-size:13px; }
  .st-conn .ag b { display:block; font-weight:500; }
  .st-conn .rule { display:flex; gap:8px; align-items:center; background:var(--accent-dim); color:var(--text); border-radius:12px; padding:10px 13px; font-size:13.5px; }
  .st-conn .rule svg { color:var(--accent); }

  /* 8. pass the keys */
  .st-keys { display:grid; grid-template-columns:1fr 44px 1fr; gap:10px; align-items:center; }
  .st-keys .pp { background:#fff; border:1px solid var(--line2); border-radius:14px; box-shadow:var(--shadow); padding:12px; display:flex; flex-direction:column; gap:7px; }
  .st-keys .who2 { display:flex; gap:9px; align-items:center; margin-bottom:3px; } .st-keys .who2 b { display:block; font-weight:500; }
  .st-keys .k { position:relative; display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:13px; padding:7px 9px; border-radius:9px; background:var(--bg2); }
  .st-keys .kx { display:inline-flex; gap:7px; align-items:center; }
  .st-keys .k em { font:500 11px var(--sans); font-style:normal; border-radius:99px; padding:2px 8px; white-space:nowrap; }
  .st-keys .from em { color:#b91c1c; background:#fdecec; }
  .st-keys .to { background:var(--accent-dim); } .st-keys .to em { color:var(--accent); background:#fff; }
  .st-keys .cut { position:absolute; left:8px; right:70px; top:50%; height:1.5px; background:#b91c1c; transform-origin:left; }
  .st-keys .cut[data-t] { opacity:1; transform:scaleX(0); } .st-keys .cut.in { transform:scaleX(1); transition:transform .4s ease; }
  .st-keys .from:has(.cut.in) .kx { opacity:.45; }
  .st-keys .mid { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; background:var(--text); color:#fff; }
  .st-keys .audit { grid-column:1 / -1; display:flex; gap:8px; align-items:center; font:12px var(--mono); color:var(--muted); background:#fff; border:1px dashed var(--line2); border-radius:10px; padding:9px 12px; }
  .st-keys .audit span { color:var(--faint); }

  @media (max-width: 960px) {
    .hc-slide { grid-template-columns:1fr; padding:26px 20px; min-height:0; gap:20px; }
    .hc-stage { min-height:0; }
  }
  @media (max-width: 620px) {
    .hc-tabs { border-radius:18px; }
    .st-trace, .st-del { grid-template-columns:1fr; }
    .st-hand { grid-template-columns:1fr; } .st-hand .lane { min-height:90px; } .st-hand .dash { left:50%; right:auto; top:0; bottom:0; border-top:0; border-left:1.5px dashed var(--line2); }
    .st-hand .baton[data-t] { transform:translateY(-60%) scale(.85); } .st-hand .baton.in { animation:flyv 1.6s cubic-bezier(.5,0,.2,1) forwards; }
    .st-status .team { grid-template-columns:1fr; }
    .st-meet .pair { grid-template-columns:1fr; } .st-meet .arrow-x { justify-self:center; transform:rotate(90deg); }
    .st-meet .cal { min-width:0; align-self:stretch; }
    .st-onb { grid-template-columns:1fr; }
    .st-conn .net { grid-template-columns:1fr; gap:10px; justify-items:center; } .st-conn .tools { flex-direction:row; } .st-conn .wire { width:2px; height:22px; margin:0; background:var(--accent); transform-origin:top; }
    .st-conn .wire[data-t] { transform:scaleY(0); } .st-conn .wire.in { transform:scaleY(1); } .st-conn .agents { width:100%; }
    .st-keys { grid-template-columns:1fr; } .st-keys .mid { justify-self:center; transform:rotate(90deg); }
  }
  @keyframes flyv { 0% { transform:translateY(-60%) scale(.85); } 50% { transform:none scale(1); } 100% { transform:translateY(60%) scale(.85); opacity:0; } }
  @media (prefers-reduced-motion: reduce) {
    .hc [data-t] { opacity:1 !important; transform:none !important; transition:none !important; animation:none !important; }
    .hc-track { transition:none; }
  }
`;

export const HERO_JS = `
(() => {
  const root = document.getElementById("hc"); if (!root) return;
  const track = document.getElementById("hcTrack");
  const slides = [...root.querySelectorAll(".hc-slide")], tabs = [...root.querySelectorAll(".hc-tab")], dots = [...root.querySelectorAll(".hc-dots i")];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DUR = 9000; let i = 0, timer = null, timers = [];
  const stage = (n) => {
    timers.forEach(clearTimeout); timers = [];
    slides.forEach((s, k) => s.querySelectorAll("[data-t]").forEach((e) => { e.classList.remove("in"); if (k !== n) return;
      if (reduce) e.classList.add("in"); else timers.push(setTimeout(() => e.classList.add("in"), parseFloat(e.dataset.t) * 1000 + 450)); }));
  };
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    track.style.transform = "translateX(-" + i * 100 + "%)";
    slides.forEach((s, k) => s.setAttribute("aria-hidden", k !== i));
    tabs.forEach((t, k) => { t.classList.toggle("on", k === i); t.classList.remove("play"); t.setAttribute("aria-selected", k === i); });
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    if (timer) { void tabs[i].offsetWidth; tabs[i].classList.add("play"); }
    stage(i);
  };
  const stop = () => { clearInterval(timer); timer = null; tabs.forEach((t) => t.classList.remove("play")); };
  root.style.setProperty("--hcdur", DUR + "ms");
  tabs.forEach((t, k) => t.onclick = () => { stop(); show(k); });
  document.getElementById("hcPrev").onclick = () => { stop(); show(i - 1); };
  document.getElementById("hcNext").onclick = () => { stop(); show(i + 1); };
  let paused = false;
  root.addEventListener("mouseenter", () => paused = true); root.addEventListener("mouseleave", () => paused = false);
  // Start when the carousel scrolls into view, so visitors see each story from its first beat.
  let started = false;
  const start = () => { if (started) return; started = true;
    if (!reduce) timer = setInterval(() => { if (!paused) show(i + 1); }, DUR);
    show(0); };
  new IntersectionObserver((es) => es[0].isIntersecting && start(), { threshold: 0.05 }).observe(root);
  setTimeout(start, 2500); // backstop: never leave the stage blank
})();
`;
