// Server-rendered pages for sign-in and CLI device approval. Plain HTML + fetch, no bundle.

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function layout(title: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg:#fafaf9; --fg:#1c1917; --muted:#78716c; --card:#fff; --line:#e7e5e4; --accent:#1c1917; --accent-fg:#fff; --err:#b91c1c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0c0a09; --fg:#f5f5f4; --muted:#a8a29e; --card:#1c1917; --line:#292524; --accent:#f5f5f4; --accent-fg:#0c0a09; --err:#f87171; }
  }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px;
         background:var(--bg); color:var(--fg); font:15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { width:100%; max-width:380px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:28px; }
  h1 { font-size:20px; margin:0 0 4px; }
  p { margin:0 0 16px; color:var(--muted); }
  .brand { font-weight:600; letter-spacing:-.01em; margin-bottom:20px; }
  label { display:block; font-size:13px; color:var(--muted); margin-bottom:6px; }
  input { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:9px; background:transparent; color:var(--fg); font:inherit; margin-bottom:12px; }
  button, .btn { display:block; width:100%; padding:10px 12px; border-radius:9px; border:1px solid var(--line); background:transparent;
                 color:var(--fg); font:inherit; font-weight:500; cursor:pointer; text-align:center; text-decoration:none; margin-bottom:8px; }
  button.primary { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
  button:disabled { opacity:.6; cursor:default; }
  .or { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:13px; margin:14px 0; }
  .or::before, .or::after { content:""; flex:1; border-top:1px solid var(--line); }
  .code { font:600 22px/1 ui-monospace, monospace; letter-spacing:.12em; text-align:center; padding:14px; border:1px dashed var(--line); border-radius:9px; margin-bottom:16px; }
  .msg { min-height:20px; font-size:13px; color:var(--muted); }
  .msg.err { color:var(--err); }
  [hidden] { display:none !important; }
  .cmd { display:flex; gap:8px; align-items:center; border:1px solid var(--line); border-radius:9px; padding:8px 8px 8px 12px; margin-bottom:12px; }
  .cmd code { flex:1; font:13px/1.4 ui-monospace, monospace; overflow-x:auto; white-space:nowrap; }
  .cmd button { width:auto; margin:0; padding:6px 10px; font-size:13px; }
  .steps { margin:0 0 18px; padding-left:20px; color:var(--muted); font-size:14px; }
  .steps code { font:13px ui-monospace, monospace; color:var(--fg); }
  main { max-width:460px; }
</style>
</head>
<body><main><div class="brand">AnyDock</div>${body}</main>
<script>
async function api(path, body) {
  const res = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error_description || data.error || ("Request failed (" + res.status + ")"));
  return data;
}
function say(text, isErr) { const m = document.getElementById("msg"); m.textContent = text; m.className = "msg" + (isErr ? " err" : ""); }
${script}
</script>
</body></html>`;
}

const INSTALL = `curl -fsSL ${"https://anydock.ai"}/install.sh | sh`;

function installBlock(origin: string): string {
  const cmd = origin === "https://anydock.ai" ? INSTALL : `curl -fsSL ${origin}/install.sh | ANYDOCK_SERVER=${origin} sh`;
  return `<label>Install the CLI (macOS / Linux, Node 22+)</label>
     <div class="cmd"><code id="cmd">${esc(cmd)}</code><button id="copy" type="button">Copy</button></div>
     <ol class="steps"><li><code>anydock login</code></li><li><code>anydock mcp install</code> — adds the tools to Claude Code and Codex</li>
     <li>In your agent: <em>"share this with jason@company.com"</em></li></ol>`;
}

const COPY_SCRIPT = `document.getElementById("copy").onclick = async () => {
  await navigator.clipboard.writeText(document.getElementById("cmd").textContent);
  document.getElementById("copy").textContent = "Copied"; setTimeout(() => document.getElementById("copy").textContent = "Copy", 1500);
};`;

export function homePage(user: { name: string; email: string } | null, origin: string): string {
  if (!user) {
    return layout(
      "AnyDock",
      `<h1>Agents made individuals 10x.</h1><p>AnyDock makes teams 10x: share and hand over your agent's work — context, trajectory and all — to teammates and their agents.</p>
       ${installBlock(origin)}<a class="btn" href="/login">Sign in</a>`,
      COPY_SCRIPT,
    );
  }
  return layout(
    "AnyDock",
    `<h1>Signed in</h1><p>${esc(user.name || user.email)} · ${esc(user.email)}</p>
     ${installBlock(origin)}<button id="out">Sign out</button><div id="msg" class="msg"></div>`,
    `${COPY_SCRIPT}
     document.getElementById("out").onclick = async () => { await api("/api/auth/sign-out", {}); location.href = "/"; };`,
  );
}

export function loginPage(opts: { next: string; providers: { github: boolean; google: boolean } }): string {
  const social = [
    opts.providers.github ? `<button data-provider="github">Continue with GitHub</button>` : "",
    opts.providers.google ? `<button data-provider="google">Continue with Google</button>` : "",
  ].join("");
  return layout(
    "Sign in · AnyDock",
    `<h1>Sign in</h1><p>Use your work email, or a connected account.</p>
     ${social}${social ? `<div class="or">or</div>` : ""}
     <form id="emailForm">
       <label for="email">Email</label>
       <input id="email" type="email" autocomplete="email" required placeholder="you@company.com">
       <button class="primary" type="submit">Email me a code</button>
     </form>
     <form id="codeForm" hidden>
       <label for="otp">6-digit code sent to <span id="sentTo"></span></label>
       <input id="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required>
       <button class="primary" type="submit">Sign in</button>
     </form>
     <div id="msg" class="msg"></div>`,
    `const next = ${JSON.stringify(opts.next)};
     let email = "";
     document.querySelectorAll("[data-provider]").forEach((b) => b.onclick = async () => {
       try { const r = await api("/api/auth/sign-in/social", { provider: b.dataset.provider, callbackURL: next }); location.href = r.url; }
       catch (e) { say(e.message, true); }
     });
     document.getElementById("emailForm").onsubmit = async (ev) => {
       ev.preventDefault(); email = document.getElementById("email").value.trim();
       try {
         await api("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" });
         document.getElementById("sentTo").textContent = email;
         document.getElementById("emailForm").hidden = true; document.getElementById("codeForm").hidden = false;
         document.getElementById("otp").focus(); say("");
       } catch (e) { say(e.message, true); }
     };
     document.getElementById("codeForm").onsubmit = async (ev) => {
       ev.preventDefault();
       try { await api("/api/auth/sign-in/email-otp", { email, otp: document.getElementById("otp").value.trim() }); location.href = next; }
       catch (e) { say(e.message, true); }
     };`,
  );
}

export function devicePage(opts: { userCode: string; email: string }): string {
  return layout(
    "Connect CLI · AnyDock",
    `<h1>Connect the AnyDock CLI</h1><p>Signed in as ${esc(opts.email)}. Check this matches the code in your terminal.</p>
     <form id="codeForm" ${opts.userCode ? "hidden" : ""}>
       <label for="code">Code from your terminal</label>
       <input id="code" autocomplete="off" required>
       <button class="primary" type="submit">Continue</button>
     </form>
     <div id="confirm" hidden>
       <div class="code" id="shown"></div>
       <button class="primary" id="approve">Approve</button>
       <button id="deny">Deny</button>
     </div>
     <div id="msg" class="msg"></div>`,
    `let userCode = ${JSON.stringify(opts.userCode)};
     async function claim() {
       try {
         await api("/api/auth/device?user_code=" + encodeURIComponent(userCode));
         document.getElementById("shown").textContent = userCode;
         document.getElementById("codeForm").hidden = true; document.getElementById("confirm").hidden = false; say("");
       } catch (e) { say(e.message, true); document.getElementById("codeForm").hidden = false; }
     }
     async function decide(action) {
       try {
         await api("/api/auth/device/" + action, { userCode });
         document.getElementById("confirm").hidden = true;
         say(action === "approve" ? "Approved. You can return to your terminal." : "Denied.");
       } catch (e) { say(e.message, true); }
     }
     document.getElementById("codeForm").onsubmit = (ev) => { ev.preventDefault(); userCode = document.getElementById("code").value.trim().toUpperCase(); claim(); };
     document.getElementById("approve").onclick = () => decide("approve");
     document.getElementById("deny").onclick = () => decide("deny");
     if (userCode) claim();`,
  );
}
