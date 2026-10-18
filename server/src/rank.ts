// Lexical relevance of trajectory steps to a question. Same scoring as the CLI's anydock_ask_why and the
// dashboard: enough to surface the right moments; the reader (or their agent) does the reasoning.
export interface Step {
  role?: string;
  type?: string;
  text?: string;
  input?: string;
  tool?: string;
}

const STOP = new Set(
  "the a an and or of to in on for with is are was were be it this that why how what did do does you we i my our from by at as".split(" "),
);

export function terms(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((t) => t.length > 1 && !STOP.has(t)))];
}

// Indices of the k most relevant steps, in trajectory order.
export function rankSteps(steps: Step[], question: string, k = 8): number[] {
  const q = terms(question);
  return steps
    .map((s, i) => {
      const hay = `${s.text ?? ""} ${s.input ?? ""} ${s.tool ?? ""}`.toLowerCase();
      let score = 0;
      for (const t of q) if (hay.includes(t)) score += 1;
      if (s.type === "text") score *= s.role === "assistant" ? 1.5 : 1.2;
      return { i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, k)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}
