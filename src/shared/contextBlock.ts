interface ContextItem {
  content: string;
  fallback?: boolean;
}

/**
 * Build the block injected into the AI conversation. Direct matches and
 * general-context fillers are labeled separately so the recipient model —
 * and the user reading the composer — can tell them apart.
 */
export function buildContextBlock(profileName: string, memories: ContextItem[]): string {
  const matched = memories.filter((m) => !m.fallback).map((m) => `- ${m.content}`);
  const general = memories.filter((m) => m.fallback).map((m) => `- ${m.content}`);

  const lines: string[] = ["[Memory Wallet Context]", `Profile: ${profileName}`];
  if (matched.length > 0) {
    lines.push(matched.length === 1 ? "Matched memory:" : "Matched memories:", ...matched);
  }
  if (general.length > 0) {
    lines.push(general.length === 1 ? "General context:" : "General context:", ...general);
  }
  if (matched.length === 0 && general.length === 0) {
    // Should not happen (callers skip empty), but keep the block valid.
    lines.push("(no memories)");
  }
  lines.push("[End Memory Wallet Context]");
  return lines.join("\n");
}
