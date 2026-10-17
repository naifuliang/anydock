import { existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

// Replaced at bundle time by scripts/build.mjs; dev runs (node src/main.ts) report build 0 and never self-update.
declare const __ANYDOCK_VERSION__: string | undefined;
declare const __ANYDOCK_BUILD__: number | undefined;

export const VERSION = typeof __ANYDOCK_VERSION__ === "string" ? __ANYDOCK_VERSION__ : "dev";
export const BUILD = typeof __ANYDOCK_BUILD__ === "number" ? __ANYDOCK_BUILD__ : 0;

// The file being run: src/main.ts in dev, ~/.anydock/bin/anydock.mjs when installed.
export const ENTRY = realpathSync(process.argv[1]!);

// install.sh puts a launcher next to the bundle that pins a stable node path. Agents should launch that,
// so the registration survives node upgrades and doesn't depend on the agent's PATH.
const launcher = join(dirname(ENTRY), "anydock");
export const COMMAND: string[] = BUILD > 0 && existsSync(launcher) ? [launcher] : [process.execPath, ENTRY];
