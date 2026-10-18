import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { ApiError } from "./api.ts";
import { loadConfig } from "./config.ts";
import { maybeCurrentSession } from "./session.ts";

// Artifacts for agents — one implementation behind both the MCP tools (anydock_artifact_*) and the CLI
// (anydock artifact …). Every function returns the text an agent should read.

export type Kind = "doc" | "slides" | "sheet" | "latex" | "html" | "app" | "file";

async function call(method: string, path: string, opts: { json?: unknown; raw?: Uint8Array; type?: string; text?: boolean } = {}): Promise<any> {
  const cfg = loadConfig();
  if (!cfg.token) throw new Error("AnyDock isn't signed in on this machine. Run: anydock login");
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.token}` };
  let body: BodyInit | undefined;
  if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.json); }
  if (opts.raw) { headers["Content-Type"] = opts.type ?? "application/octet-stream"; body = new Blob([opts.raw as Uint8Array<ArrayBuffer>]); }
  const res = await fetch(cfg.server + path, { method, headers, body });
  if (opts.text && res.ok) return res.text();
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 409 || res.status === 403) throw new Error((data as any)?.message ?? `HTTP ${res.status}`);
    throw new ApiError(res.status, data);
  }
  return data;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".wasm": "application/wasm", ".mp4": "video/mp4",
};
const mime = (p: string) => MIME[extname(p).toLowerCase()] ?? "application/octet-stream";

// A one-time link that signs the agent's built-in browser in (single use, 2 minutes) and lands on the artifact.
export async function signInLink(path: string): Promise<string> {
  return (await call("POST", "/api/sign-in-link", { json: { next: path } })).url;
}

const showIt = async (a: { id: string; url: string }) =>
  `Show it to the user now, visibly:\n` +
  `  • Built-in browser (Claude or Codex desktop app): open ${await signInLink(`/a/${a.id}`)} — a one-time link that signs that browser in (use it within 2 minutes) — then bring the browser panel to the front so the user sees it.\n` +
  `  • No built-in browser: anydock_artifact_open id=${a.id} (CLI: anydock open ${a.id}) — a window on a Mac, already signed in.\n` +
  `  Share ${a.url} with people (not the one-time link).`;

// ---------- create ----------

export type OutlineItem = string | { heading: string; brief?: string; level?: number };

export async function createArtifact(a: { title: string; type: Kind; outline?: OutlineItem[]; content?: string; rows?: unknown[][] }): Promise<string> {
  if (a.type === "app" || a.type === "file") {
    return `To make a ${a.type}, upload it instead: anydock_artifact_upload path=<${a.type === "app" ? "folder with index.html" : "file"}> (CLI: anydock artifact upload <path>).`;
  }
  const session = maybeCurrentSession();
  const outline = a.outline?.map((o) => {
    if (typeof o !== "string") return o;
    const m = o.match(/^(#{1,2})?\s*([^:]+?)(?::\s*(.+))?$/); // "## Heading: what goes here"
    return m ? { heading: m[2]!.trim(), level: m[1] ? m[1].length : undefined, brief: m[3]?.trim() } : { heading: o };
  });
  const { artifact } = await call("POST", "/api/artifacts", { json: { title: a.title, kind: a.type, outline, content: a.content, rows: a.rows, ...session } });
  const full = await call("GET", `/api/artifacts/${artifact.id}`);
  const todo = full.sections.filter((s: any) => s.status === "todo");
  const lines = [`Created ${a.type} "${a.title}" — ${artifact.url}`, `id: ${artifact.id}${artifact.workId ? " (attached to this session's work)" : ""}`, await showIt(artifact)];
  if (todo.length) {
    lines.push(`Skeleton: ${full.sections.length} sections, ${todo.length} still to write. Fill them one by one — the user watches each appear:`);
    full.sections.forEach((s: any, i: number) => lines.push(`  ${i + 1}. ${s.heading || "(intro)"}${s.status === "todo" ? " — to write" : ""}${s.brief ? ` (${s.brief})` : ""}`));
    lines.push(`Write one: anydock_artifact_write id=${artifact.id} section=<number or heading> content=<markdown>  (CLI: anydock artifact write ${artifact.id} <section> --file <md>)`);
  }
  return lines.join("\n");
}

// ---------- read ----------

export async function readArtifact(id: string, section?: string): Promise<string> {
  const full = await call("GET", `/api/artifacts/${id}`);
  const a = full.artifact;
  const head = [`${a.title} — ${a.kind}${a.kind === "file" ? ` (.${a.format})` : ""}, ${a.access === "view" ? "view only" : "you can edit"} · ${a.url}`];
  if (full.work) head.push(`Made in work "${full.work.title}" (anydock_read_work id=${full.work.id} for how and why).`);
  const locked = full.sections.filter((s: any) => s.locked);
  locked.forEach((s: any) => head.push(`Note: ${s.lockedName} is editing "${s.heading}" right now — leave that section alone.`));
  if (a.kind === "doc" || a.kind === "slides") {
    head.push("Sections: " + full.sections.map((s: any, i: number) => `${i + 1}. ${s.heading || "(intro)"}${s.status !== "done" ? ` [${s.status}]` : ""}`).join(" · "));
  }
  const text = await call("GET", `/api/artifacts/${id}/text${section ? `?section=${encodeURIComponent(section)}` : ""}`, { text: true });
  return head.join("\n") + "\n\n" + text;
}

// ---------- write ----------

function pickSection(sections: any[], ref: string): any | undefined {
  if (/^\d+$/.test(ref)) return sections[Number(ref) - 1];
  return sections.find((s) => s.id === ref) ?? sections.find((s) => s.heading.toLowerCase() === ref.toLowerCase()) ?? sections.find((s) => s.heading.toLowerCase().includes(ref.toLowerCase()));
}

export async function writeArtifact(a: { id: string; section?: string; content: string; heading?: string; after?: string; status?: "writing" | "done" }): Promise<string> {
  const full = await call("GET", `/api/artifacts/${a.id}`);
  const art = full.artifact;
  const secs = full.sections;
  if (art.kind === "sheet") {
    const rows = a.content.includes("\t") ? a.content.trim().split("\n").map((l) => l.split("\t")) : parseCsv(a.content);
    const tab = a.section ? pickSection(secs, a.section) : secs[0];
    await call("PUT", `/api/artifacts/${a.id}/sheet/${tab ? tab.id : "new"}`, { json: { rows, name: tab ? undefined : a.section } });
    return `Wrote ${rows.length} rows to ${tab ? tab.heading : a.section ?? "a new sheet"} of "${art.title}". ${art.url}`;
  }
  if (art.kind === "latex" || art.kind === "html") {
    await call("PUT", `/api/artifacts/${a.id}/sections/${secs[0].id}`, { json: { body: a.content, status: "done" } });
    return `Updated the ${art.kind === "latex" ? "LaTeX source" : "page"} of "${art.title}" (the preview refreshes live). ${art.url}`;
  }
  if (art.kind !== "doc" && art.kind !== "slides") return `"${art.title}" is a ${art.kind}; upload a new version instead: anydock_artifact_upload id=${a.id} path=<path>.`;
  if (!a.section || a.section === "all") {
    await call("PUT", `/api/artifacts/${a.id}/content`, { json: { content: a.content } });
    return `Replaced the whole ${art.kind === "slides" ? "deck" : "document"} "${art.title}". ${art.url}`;
  }
  const target = a.section === "new" ? undefined : pickSection(secs, a.section);
  if (!target) {
    const after = a.after ? pickSection(secs, a.after) : undefined;
    const { section } = await call("POST", `/api/artifacts/${a.id}/sections`, { json: { heading: a.heading ?? (a.section === "new" ? "New section" : a.section), body: a.content, status: a.status ?? "done", after: after ? after.id : undefined } });
    return `Added section "${section.heading}" to "${art.title}". ${art.url}`;
  }
  await call("PUT", `/api/artifacts/${a.id}/sections/${target.id}`, { json: { body: a.content, heading: a.heading, status: a.status ?? "done" } });
  const left = secs.filter((s: any) => s.id !== target.id && s.status !== "done").map((s: any) => s.heading);
  return `Wrote "${a.heading ?? target.heading}" in "${art.title}".` + (left.length ? ` Still to write: ${left.join(", ")}.` : " Every section is written.");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { rows[rows.length - 1]!.push(cur); cur = ""; }
    else if (ch === "\n") { rows[rows.length - 1]!.push(cur.replace(/\r$/, "")); cur = ""; rows.push([]); }
    else cur += ch;
  }
  rows[rows.length - 1]!.push(cur);
  if (rows.length > 1 && rows[rows.length - 1]!.join("") === "") rows.pop();
  return rows;
}

// ---------- upload (files, folders, and text formats that become live artifacts) ----------

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name === "node_modules") return [];
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export async function uploadArtifact(a: { path: string; id?: string; title?: string }): Promise<string> {
  const st = statSync(a.path);
  const ext = extname(a.path).toLowerCase();
  const name = basename(a.path);
  // Text formats become live, co-editable artifacts.
  const live: Record<string, Kind> = { ".md": "doc", ".markdown": "doc", ".tex": "latex", ".csv": "sheet" };
  if (st.isFile() && !a.id && (live[ext] || ext === ".html")) {
    const kind: Kind = live[ext] ?? "html";
    const content = readFileSync(a.path, "utf8");
    return createArtifact({ title: a.title ?? name.replace(/\.[^.]+$/, ""), type: kind, content });
  }
  let id = a.id;
  if (!id) {
    const session = maybeCurrentSession();
    const kind: Kind = st.isDirectory() ? "app" : "file";
    ({ artifact: { id } } = await call("POST", "/api/artifacts", { json: { title: a.title ?? name, kind, format: st.isDirectory() ? "html" : ext.slice(1) || "bin", ...session } }));
  }
  const files = st.isDirectory() ? walk(a.path).map((p) => ({ abs: p, rel: relative(a.path, p).split("\\").join("/") })) : [{ abs: a.path, rel: name }];
  if (!files.length) throw new Error(`${a.path} is empty.`);
  if (st.isDirectory() && !files.some((f) => f.rel.endsWith(".html"))) throw new Error(`${a.path} has no .html file to run.`);
  const { version } = await call("POST", `/api/artifacts/${id}/versions`);
  for (const f of files) {
    await call("PUT", `/api/artifacts/${id}/versions/${version}/files/${f.rel.split("/").map(encodeURIComponent).join("/")}`, { raw: readFileSync(f.abs), type: mime(f.rel) });
  }
  await call("POST", `/api/artifacts/${id}/versions/${version}/done`);
  const full = await call("GET", `/api/artifacts/${id}`);
  const art = full.artifact;
  return [`Uploaded ${files.length} file(s) as version ${version} of "${art.title}" (${art.kind}) — ${art.url}`, `id: ${art.id}`,
    art.appUrl ? `It runs at ${art.appUrl}` : "", await showIt(art)].filter(Boolean).join("\n");
}

// ---------- list / share / handover / open ----------

export async function listArtifacts(): Promise<string> {
  const { artifacts } = await call("GET", "/api/artifacts");
  if (!artifacts.length) return "No artifacts yet.";
  return artifacts.slice(0, 50).map((a: any) => `${a.id.slice(0, 8)}  ${a.kind.padEnd(6)}  ${a.title}  — ${a.ownerName || a.ownerEmail} · ${a.updatedAt.slice(0, 16).replace("T", " ")}`).join("\n");
}

export async function resolveId(prefix: string): Promise<string> {
  if (/^[0-9a-f-]{36}$/.test(prefix)) return prefix;
  const { artifacts } = await call("GET", "/api/artifacts");
  const hits = artifacts.filter((a: any) => a.id.startsWith(prefix) || a.title.toLowerCase() === prefix.toLowerCase());
  if (hits.length !== 1) throw new Error(hits.length ? `"${prefix}" matches ${hits.length} artifacts; use more of the id.` : `No artifact matches "${prefix}".`);
  return hits[0].id;
}

export async function shareArtifact(a: { id: string; to: string; role?: "viewer" | "editor"; handover?: boolean; note?: string }): Promise<string> {
  const path = `/api/artifacts/${a.id}/${a.handover ? "handover" : "share"}`;
  await call("POST", path, { json: { to: a.to, role: a.role ?? "editor", note: a.note } });
  return a.handover
    ? `Handed it over to ${a.to}: they own it now (with its history); you can still edit. It's in their AnyDock inbox.`
    : `Shared with ${a.to} (${a.role === "viewer" ? "can view" : "can edit"}). It's in their AnyDock inbox.`;
}

export async function artifactUrl(id: string): Promise<{ url: string; title: string }> {
  const { artifact } = await call("GET", `/api/artifacts/${id}`);
  return { url: artifact.url, title: artifact.title };
}
