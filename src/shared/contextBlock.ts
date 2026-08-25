import type { MemorySource } from "./types";

interface ContextItem {
  content: string;
  source: MemorySource;
}

const SECTION_LABELS: Record<MemorySource, string> = {
  keyword: "Matched memories",
  semantic: "Semantic matches",
  general: "General context",
};

/**
 * Build the block injected into the AI conversation. Items are grouped by
 * provenance so the recipient model — and the user reading the composer —
 * can tell exact matches, embedding matches, and general fill apart.
 */
export function buildContextBlock(profileName: string, memories: ContextItem[]): string {
  const lines: string[] = ["[Memory Wallet Context]", `Profile: ${profileName}`];

  for (const source of ["keyword", "semantic", "general"] as MemorySource[]) {
    const items = memories.filter((m) => m.source === source);
    if (items.length === 0) continue;
    lines.push(SECTION_LABELS[source] + ":");
    for (const item of items) lines.push(`- ${item.content}`);
  }

  if (lines.length === 2) {
    // Should not happen (callers skip empty), but keep the block valid.
    lines.push("(no memories)");
  }

  lines.push("[End Memory Wallet Context]");
  return lines.join("\n");
}
