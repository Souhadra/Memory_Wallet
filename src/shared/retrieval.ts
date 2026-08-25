import type { Memory, MemoryCategory, MemorySource } from "./types";
import { getMemoriesForProfile, getSettings } from "./storage";
import { CATEGORY_HINTS, CATEGORY_PRIORITY, QUERY_SYNONYMS } from "./constants";
import { getVectorsByProfile } from "./vectorStore";
import { EMBED_MSG } from "./messages";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","for","of","to","in","on","at","by",
  "with","from","is","are","was","were","be","been","being","am","do","does","did","doing",
  "have","has","had","i","me","my","mine","we","our","you","your","it","its","this","that",
  "these","those","what","which","who","whom","how","when","where","why","should","could",
  "would","will","can","use","using","used","am","about","as","into","over","under","not",
]);

/** Minimum cosine similarity for a Tier-2 semantic match. */
const SEMANTIC_THRESHOLD = 0.35;
/** Never let a cold model delay the permission card. */
const QUERY_EMBED_TIMEOUT_MS = 800;

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

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // Vectors are L2-normalized at embed time, so dot product == cosine.
  return dot;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Ask the background (which routes to the offscreen model host) for one embedding. */
async function embedQuery(query: string): Promise<number[] | null> {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
    const res = (await withTimeout(
      chrome.runtime.sendMessage({ type: EMBED_MSG.EMBED_QUERY, texts: [query] }),
      QUERY_EMBED_TIMEOUT_MS,
    )) as { ok?: boolean; vectors?: number[][] } | undefined | null;
    if (!res?.ok || !res.vectors?.[0]) return null;
    return res.vectors[0];
  } catch {
    return null;
  }
}

export interface RetrievedMemory extends Memory {
  score: number;
  /** How this memory was selected: exact word hit, embedding, or general fill. */
  source: MemorySource;
}

export interface RetrievalDebug {
  keyword: number;
  semantic: number;
  general: number;
}

/**
 * Hybrid retrieval from a single profile:
 *
 * Tier 1 — keyword: token/synonym overlap × importance + category boost.
 * Tier 2 — semantic: local embedding cosine similarity (skipped silently
 *          when the model/index isn't ready or the setting is off).
 * Tier 3 — general: strongest remaining memories (category priority →
 *          importance → newest), used to fill remaining slots when allowed.
 *
 * Every memory carries `source` so previews and the injected block can be
 * honest about why each item was included. Only call AFTER approval
 * (previews are computed pre-approval but nothing leaves the device).
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

  // ---- Tier 1: keyword ------------------------------------------------
  const keywordHits = memories
    .map((m) => ({ ...m, score: scoreMemory(m, queryTokens, hintedCategories), source: "keyword" as const }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const results: RetrievedMemory[] = [...keywordHits];

  // ---- Tier 2: semantic ----------------------------------------------
  const semanticSlots = limit - results.length;
  if (semanticSlots > 0 && settings.semanticSearch !== false) {
    try {
      const vectors = await getVectorsByProfile(profileId);
      if (vectors.length > 0) {
        const queryVector = await embedQuery(query);
        if (queryVector) {
          const chosen = new Set(results.map((r) => r.id));
          const semanticHits = vectors
            .filter((v) => !chosen.has(v.memoryId))
            .map((v) => ({ memoryId: v.memoryId, similarity: cosine(queryVector, v.vector) }))
            .filter((x) => x.similarity >= SEMANTIC_THRESHOLD)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit - results.length);

          for (const hit of semanticHits) {
            const memory = memories.find((m) => m.id === hit.memoryId);
            if (memory && !results.some((r) => r.id === memory.id)) {
              results.push({ ...memory, score: hit.similarity, source: "semantic" });
            }
          }
        }
      }
    } catch {
      // No IndexedDB / no runtime / index not ready — semantic tier skipped.
    }
  }

  // ---- Tier 3: general fill -------------------------------------------
  if (results.length < limit && settings.allowGeneralFallback !== false) {
    const chosenIds = new Set(results.map((r) => r.id));
    const fillers = memories
      .filter((m) => !chosenIds.has(m.id))
      .sort((a, b) => {
        const rank = categoryRank(a.category) - categoryRank(b.category);
        if (rank !== 0) return rank;
        if (b.importance !== a.importance) return b.importance - a.importance;
        return b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, limit - results.length)
      .map((m) => ({ ...m, score: 0, source: "general" as const }));
    results.push(...fillers);
  }

  return results;
}

/** Counts by provenance — used by previews and the requests log. */
export function countBySource(memories: RetrievedMemory[]): RetrievalDebug {
  return {
    keyword: memories.filter((m) => m.source === "keyword").length,
    semantic: memories.filter((m) => m.source === "semantic").length,
    general: memories.filter((m) => m.source === "general").length,
  };
}
