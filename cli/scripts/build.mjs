// Bundles the CLI into one file and publishes it into the Worker's static assets:
//   server/public/cli/anydock.mjs   the CLI
//   server/public/cli/version.json  what self-update checks
// Run: npm run build (then deploy the server).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
const buildNo = Math.floor(Date.now() / 1000); // monotonic: newer bundles always compare greater
const version = `${pkg.version}+${buildNo}.${sha}`;
const outDir = new URL("../../server/public/cli/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const result = await build({
  entryPoints: [new URL("../src/main.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: false,
  write: false,
  define: { __ANYDOCK_VERSION__: JSON.stringify(version), __ANYDOCK_BUILD__: String(buildNo) },
  legalComments: "none",
});
const code = result.outputFiles[0].contents;
writeFileSync(new URL("anydock.mjs", outDir), code);
const sha256 = createHash("sha256").update(code).digest("hex");
writeFileSync(
  new URL("version.json", outDir),
  JSON.stringify({ version, build: buildNo, url: "/cli/anydock.mjs", sha256, minNode: 22 }, null, 2) + "\n",
);
console.log(`Built anydock ${version} (build ${buildNo}, ${(code.length / 1024).toFixed(0)} KB) → server/public/cli/`);
