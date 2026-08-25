import type { Memory, MemoryCategory } from "./types";
import { getMemoriesForProfile, getSettings } from "./storage";
import { CATEGORY_HINTS, CATEGORY_PRIORITY, QUERY_SYNONYMS } from "./constants";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","for","of","to","in","on","at","by",
  "with","from","is","are","was","were","be","been","being","am","do","does","did","doing",
  "have","has","had","i","me","my","mine","we","our","you","your","it","its","this","that",
  "these","those","what","which","who","whom","how","when","where","why","should","could",
  "would","will","can","use","using","used","am","about","as","into","over","under","not",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Expand query tokens with curated synonyms so semantically close memories
 * match even with zero literal overlap ("masters" → education/degree/...).
 */
function expandTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) {
    const synonyms = QUERY_SYNONYMS[t];
    if (synonyms) for (const s of synonyms) out.add(s);
  }
  return [...out];
}

/** Infer which memory categories a query touches (keyword hints, no ML). */
export function inferCategoriesFromQuery(query: string): MemoryCategory[] {
  const q = query.toLowerCase();
  const matched: MemoryCategory[] = [];
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS) as [MemoryCategory, string[]][]) {
    if (hints.some((h) => q.includes(h))) matched.push(cat);
  }
  return matched;
}

function categoryRank(category: MemoryCategory): number {
  const idx = CATEGORY_PRIORITY.indexOf(category);
  return idx === -1 ? CATEGORY_PRIORITY.length : idx;
}

/**
 * Score a single memory against expanded query tokens.
 * V0 heuristic: keyword overlap weighted by importance + a small boost when
 * the memory's category matches what the query is about. Swap this module
 * for embeddings later without touching callers.
 */
function scoreMemory(
  memory: Memory,
  queryTokens: string[],
  hintedCategories: MemoryCategory[],
): number {
  const memTokens = new Set(tokenize(memory.content));
  let overlap = 0;
  if (memTokens.size > 0 && queryTokens.length > 0) {
    for (const t of queryTokens) {
      if (memTokens.has(t)) overlap++;
      else {
        // Light stemming: plural / simple suffix match.
        for (const m of memTokens) {
          if (m.startsWith(t) || t.startsWith(m)) {
            overlap += 0.5;
            break;
          }
        }
      }
    }
  }

  let score = (overlap / Math.sqrt(Math.max(queryTokens.length, 1))) * (0.5 + memory.importance);
  if (hintedCategories.includes(memory.category)) {
    score += 0.35 * memory.importance;
  }
  return score;
}

export interface RetrievedMemory extends Memory {
  score: number;
  /** True when included as general context rather than a direct match. */
  fallback?: boolean;
}

/**
 * Retrieve relevant memories from a single profile.
 *
 * Tier 1 — direct matches: token/synonym overlap × importance + category boost.
 * Tier 2 — general-context fill: when direct matches are fewer than `limit`
 *          (and the setting allows), fill remaining slots with the profile's
 *          strongest memories (category priority → importance → newest).
 *          These are marked `fallback: true` so the UI can label them honestly.
 *
 * Only call this AFTER the user has approved access.
 */
export async function retrieveRelevantMemories(
  query: string,
  profileId: string,
  limit = 5,
): Promise<RetrievedMemory[]> {
  const memories = await getMemoriesForProfile(profileId);
  const settings = await getSettings();

  const rawTokens = tokenize(query);
  const hintedCategories = inferCategoriesFromQuery(query);
  const queryTokens = expandTokens(rawTokens);

  const direct = memories
    .map((m) => ({ ...m, score: scoreMemory(m, queryTokens, hintedCategories) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (direct.length >= limit || settings.allowGeneralFallback === false) {
    return direct;
  }

  const chosenIds = new Set(direct.map((d) => d.id));
  const fallbacks = memories
    .filter((m) => !chosenIds.has(m.id))
    .sort((a, b) => {
      const rank = categoryRank(a.category) - categoryRank(b.category);
      if (rank !== 0) return rank;
      if (b.importance !== a.importance) return b.importance - a.importance;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limit - direct.length)
    .map((m) => ({ ...m, score: 0, fallback: true }));

  return [...direct, ...fallbacks];
}
