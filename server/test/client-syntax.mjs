// The dashboard's browser code lives in a string inside src/app.ts, so TypeScript can't see syntax errors in it.
// This renders the page and syntax-checks the inline script. Usage: node test/client-syntax.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appPage } from "../src/app.ts";
import { landingPage } from "../src/landing.ts";
import { artifactPage } from "../src/artifact-page.ts";

let failures = 0;
const dir = mkdtempSync(join(tmpdir(), "anydock-client-"));
const pages = {
  dashboard: appPage({ name: "Demo", email: "demo@example.com" }, "https://anydock.ai", true),
  landing: landingPage({ signedIn: false, origin: "https://anydock.ai" }),
  artifact: artifactPage({ id: "x", me: { id: "u", name: "Demo", email: "demo@example.com" }, origin: "https://anydock.ai" }),
};
for (const [name, html] of Object.entries(pages)) {
  const scripts = [...html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((js, i) => {
    const file = join(dir, `${name}-${i}.js`);
    writeFileSync(file, js);
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
      console.log(`PASS ${name} script ${i} parses`);
    } catch (e) {
      failures++;
      console.log(`FAIL ${name} script ${i}: ${String(e.stderr).split("\n").slice(0, 4).join(" | ")}`);
    }
  });
}
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
