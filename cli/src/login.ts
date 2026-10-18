import { spawn } from "node:child_process";
import { api, ApiError } from "./api.ts";
import { loadConfig, saveConfig } from "./config.ts";
import { ensureApprovalKey } from "./native/approve.ts";
import { hostname } from "node:os";

const CLIENT_ID = "anydock-cli";
const GRANT = "urn:ietf:params:oauth:grant-type:device_code";

interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

// OAuth device flow: show a code, the user approves it in the browser, we poll for a session token.
export async function login(opts: { server?: string; openBrowser: boolean }): Promise<void> {
  const cfg = { ...loadConfig(), ...(opts.server ? { server: opts.server.replace(/\/$/, "") } : {}) };
  delete cfg.token;
  delete cfg.user;

  const code = await api<DeviceCode>("POST", "/api/auth/device/code", { client_id: CLIENT_ID }, cfg);
  console.log(`\nOpen ${code.verification_uri} and confirm this code:\n\n    ${code.user_code}\n`);
  if (opts.openBrowser && !process.env.ANYDOCK_NO_BROWSER) openUrl(code.verification_uri_complete);

  // On a Mac, enroll this Mac's approval key with this sign-in: approving the code in the browser is what makes
  // the key trusted. A fresh key per sign-in, so an old key can't be reused with a new session.
  const approvalKey = ensureApprovalKey({ fresh: true });
  const enroll = approvalKey ? { approval_key: approvalKey, approval_key_name: hostname().replace(/\.local$/, "") } : {};

  let interval = code.interval * 1000;
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const token = await api<{ access_token: string }>(
        "POST",
        "/api/auth/device/token",
        { grant_type: GRANT, device_code: code.device_code, client_id: CLIENT_ID, ...enroll },
        cfg,
      );
      cfg.token = token.access_token;
      const { user } = await api<{ user: { id: string; email: string; name: string } }>("GET", "/api/me", undefined, cfg);
      cfg.user = user;
      saveConfig(cfg);
      console.log(`Signed in as ${user.email} (${cfg.server})`);
      return;
    } catch (e) {
      const err = e instanceof ApiError ? (e.data as { error?: string })?.error : undefined;
      if (err === "authorization_pending") continue;
      if (err === "slow_down") {
        interval += 5000;
        continue;
      }
      if (err === "access_denied") throw new Error("Sign-in was denied in the browser.");
      if (err === "expired_token") break;
      throw e;
    }
  }
  throw new Error("The code expired. Run anydock login again.");
}

export function logout(): void {
  const cfg = loadConfig();
  delete cfg.token;
  delete cfg.user;
  saveConfig(cfg);
  console.log("Signed out.");
}

function openUrl(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}
