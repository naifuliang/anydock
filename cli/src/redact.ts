// Best-effort secret scrubbing before anything is uploaded. Errs on the side of redacting.
const PATTERNS: [RegExp, string | ((...m: string[]) => string)][] = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  [/\bsk-ant-[A-Za-z0-9_-]{10,}/g, "[REDACTED]"],
  [/\bsk-(?:proj-|live_|test_)?[A-Za-z0-9_-]{20,}/g, "[REDACTED]"],
  [/\b(?:rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/g, "[REDACTED]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[REDACTED]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED]"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, "[REDACTED]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "[REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED JWT]"],
  [/(\bBearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi, (_m, p) => `${p}[REDACTED]`],
  // KEY=value / "api_key": "value" style assignments whose name looks secret.
  [
    /(\b[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*["']?\s*[:=]\s*["']?)([^\s"',]{6,})/gi,
    (_m, p) => `${p}[REDACTED]`,
  ],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep as never);
  return out;
}
