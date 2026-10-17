import { api, ApiError } from "./api.ts";
import { loadConfig } from "./config.ts";
import { installMcp } from "./install.ts";
import { login } from "./login.ts";
import { installService } from "./service.ts";

// Everything after install, in one go: sign in, connect Claude Code + Codex, start background sync.
// Safe to re-run: each step is idempotent and skips what's already done.
export async function setup(opts: { openBrowser: boolean; service: boolean }): Promise<void> {
  console.log("1/3 Sign in");
  const cfg = loadConfig();
  let signedIn = false;
  if (cfg.token) {
    try {
      const { user } = await api<{ user: { email: string } }>("GET", "/api/me", undefined, cfg);
      console.log(`    Already signed in as ${user.email}.`);
      signedIn = true;
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
  }
  if (!signedIn) await login({ openBrowser: opts.openBrowser });

  console.log("\n2/3 Connect your agents");
  installMcp();

  console.log("\n3/3 Background sync");
  if (!opts.service) console.log("    Skipped (--no-service). Run `anydock watch` to sync live.");
  else {
    try {
      console.log(`    ${installService()}`);
    } catch (e) {
      // Not fatal: sharing still works; only live syncing of later progress needs the watcher.
      console.log(`    Couldn't start it (${(e as Error).message}). Run \`anydock service install\` again, or \`anydock watch\` in a terminal.`);
    }
  }

  console.log(`
Done. Restart Claude Code / Codex, then just ask your agent, e.g.
  "share this session with jason@company.com"
  "hand this over to ashley@company.com — she's taking the demo"
  "what did teammates send me on AnyDock?"
Nothing leaves this machine until you share it.`);
}
