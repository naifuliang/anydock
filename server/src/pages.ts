// Server-rendered pages for sign-in and CLI device approval. Plain HTML + fetch, no bundle.
import { LOGO } from "./landing.ts";
import { brand, logo } from "./icons.ts";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function layout(title: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="/img/icon.svg?v=2" type="image/svg+xml"><link rel="icon" href="/img/icon-32.png?v=2" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
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
  .brand { display:flex; align-items:center; gap:8px; font-weight:600; letter-spacing:-.01em; margin-bottom:20px; }
  label { display:block; font-size:13px; color:var(--muted); margin-bottom:6px; }
  input { width:100%; padding:10px 12px; border:1px solid var(--line); border-radius:9px; background:transparent; color:var(--fg); font:inherit; margin-bottom:12px; }
  button, .btn { display:block; width:100%; padding:10px 12px; border-radius:9px; border:1px solid var(--line); background:transparent;
                 color:var(--fg); font:inherit; font-weight:500; cursor:pointer; text-align:center; text-decoration:none; margin-bottom:8px; }
  button.primary { background:var(--accent); color:var(--accent-fg); border-color:var(--accent); }
  button:disabled { opacity:.6; cursor:default; }
  button[data-provider] { display:flex; align-items:center; justify-content:center; gap:10px; }
  button[data-provider] svg { flex:none; }
  .or { display:flex; align-items:center; gap:10px; color:var(--muted); font-size:13px; margin:14px 0; }
  .or::before, .or::after { content:""; flex:1; border-top:1px solid var(--line); }
  .code { font:600 22px/1 ui-monospace, monospace; letter-spacing:.12em; text-align:center; padding:14px; border:1px dashed var(--line); border-radius:9px; margin-bottom:16px; }
  .msg { min-height:20px; font-size:13px; color:var(--muted); }
  .msg.err { color:var(--err); }
  [hidden] { display:none !important; }
  .cmd { display:flex; gap:8px; align-items:center; border:1px solid var(--line); border-radius:9px; padding:8px 8px 8px 12px; margin-bottom:12px; }
  .cmd code { flex:1; font:13px/1.4 ui-monospace, monospace; overflow-x:auto; white-space:nowrap; }
  .cmd button { width:auto; margin:0; padding:6px 10px; font-size:13px; }
  .tabs { display:flex; gap:4px; margin:4px 0 12px; border-bottom:1px solid var(--line); }
  .tabs .tab { width:auto; margin:0 0 -1px; border:0; border-bottom:2px solid transparent; border-radius:0; padding:8px 10px; color:var(--muted); }
  .tabs .tab.on { color:var(--fg); border-bottom-color:var(--fg); }
  .fine { font-size:13px; margin:0 0 18px; }
  main { max-width:460px; }
</style>
</head>
<body><main><div class="brand">${LOGO}AnyDock</div>${body}</main>
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

export function loginPage(opts: { next: string; providers: { github: boolean; google: boolean } }): string {
  const social = [
    opts.providers.github ? `<button data-provider="github">${brand("github", 18, "currentColor")}Continue with GitHub</button>` : "",
    opts.providers.google ? `<button data-provider="google">${logo("google-g", 18)}Continue with Google</button>` : "",
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
       <p style="font-size:13px;color:#6b6b72;margin:0 0 14px">Your agents on that computer will act within your rules. On a Mac, approving their requests will need your Touch ID or Mac password — never the agent.</p>
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
         say(action === "approve" ? "Approved. You can go back to your terminal or agent." : "Denied.");
       } catch (e) { say(e.message, true); }
     }
     document.getElementById("codeForm").onsubmit = (ev) => { ev.preventDefault(); userCode = document.getElementById("code").value.trim().toUpperCase(); claim(); };
     document.getElementById("approve").onclick = () => decide("approve");
     document.getElementById("deny").onclick = () => decide("deny");
     if (userCode) claim();`,
  );
}
