import type { Memory, MemoryCategory, MemorySource } from "./types";
import { getMemoriesForProfile, getSettings } from "./storage";
import { CATEGORY_PRIORITY, QUERY_SYNONYMS } from "./constants";
import { getVectorsByProfile } from "./vectorStore";
import { EMBED_MSG } from "./messages";
import { embedBudgetMs } from "./embedBudget";
import { inferCategoriesFromQuery } from "./classify";
import { analyzeQuery, buildDf, isCompoundFalseFriend, scoreMatch, type RankDoc } from "./rank";

export { inferCategoriesFromQuery } from "./classify";

/** Minimum cosine similarity for a semantic match. */
const SEMANTIC_THRESHOLD = 0.38;
/** Above this, a semantic match outranks any keyword-only match. */
const SEMANTIC_STRONG = 0.58;
/** Set once the model has answered. Until then (first question after the browser or the
 *  worker starts) the wait is short, so a held message never sits behind a cold model load;
 *  a warm model gets the generous budget. See embedBudget.ts. */
let modelKnownWarm = false;

/** "What do you know about me?" and friends — answer from the profile itself. */
function isProfileSummary(query: string): boolean {
  return /\b(what do you know about me|what can you tell me about me|tell me about myself|who am i|summaris?e me|my profile)\b/i.test(query)
    || /\b(know|remember)\b[\s\S]*\babout me\b/i.test(query)
    || /\b(list|show|what) (all|every) (of )?(my )?memor(?:y|ies)\b/i.test(query)
    || /\bmemor(?:y|ies) (do )?you have about me\b/i.test(query);
}

/** "Which facts are outdated?" — use update history rather than topic matching. */
function isTemporalQuery(query: string): boolean {
  return /\b(outdated|stale|no longer (?:true|relevant)|old facts|what changed|which facts have changed)\b/i.test(query);
}

/** The bundled MiniLM model is English-only; non-English scripts need a
 *  documented fallback instead of meaningless embeddings. */
function isNonEnglish(query: string): boolean {
  return /[\u00C0-\u024F\u3040-\u30FF\u3400-\u9FFF\u0400-\u04FF\uAC00-\uD7AF]/.test(query);
}

function categoryRank(category: MemoryCategory): number {
  const idx = CATEGORY_PRIORITY.indexOf(category);
  return idx === -1 ? CATEGORY_PRIORITY.length : idx;
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
      embedBudgetMs(modelKnownWarm),
    )) as { ok?: boolean; vectors?: number[][] } | undefined | null;
    if (!res?.ok || !res.vectors?.[0]) return null;
    modelKnownWarm = true;
    return res.vectors[0];
  } catch {
    return null;
  }
}

export interface RetrievedMemory extends Memory {
  score: number;
  /** How this memory was selected: exact phrase/word hit, embedding, or general fill. */
  source: MemorySource;
}

export interface RetrievalDebug {
  keyword: number;
  semantic: number;
  general: number;
}

interface Hit {
  memory: Memory;
  score: number;
  source: MemorySource;
}

/**
 * Hybrid retrieval from a single profile.
 *
 * Meaning comes first: the local embedding ranks by similarity, so a query
 * "my background in AI" matches AI facts even with no shared words. Keyword
 * evidence is phrase/anchor aware (see rank.ts) and can only add a memory —
 * a single ambiguous word like "background" no longer wins on its own.
 * General fill is last and opt-in.
 */
export async function retrieveRelevantMemories(
  query: string,
  profileId: string,
  limit = 5,
): Promise<RetrievedMemory[]> {
  const memories = await getMemoriesForProfile(profileId);
  if (memories.length === 0) return [];
  const settings = await getSettings();

  const priority = (a: Memory, b: Memory) => {
    const rank = categoryRank(a.category) - categoryRank(b.category);
    if (rank !== 0) return rank;
    if (b.importance !== a.importance) return b.importance - a.importance;
    return b.createdAt.localeCompare(a.createdAt);
  };

  if (isProfileSummary(query)) {
    return [...memories].sort(priority).slice(0, limit).map((m) => ({
      ...m, score: 0, source: "general" as const,
    }));
  }
  if (isTemporalQuery(query)) {
    const updated = memories
      .filter((m) => (m.previousValues?.length ?? 0) > 0)
      .sort((a, b) => (b.previousValues?.length ?? 0) - (a.previousValues?.length ?? 0));
    if (updated.length > 0) {
      return updated.slice(0, limit).map((m) => ({ ...m, score: 1, source: "keyword" as const }));
    }
    return [...memories].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit).map((m) => ({ ...m, score: 0, source: "general" as const }));
  }

  const nonEnglish = isNonEnglish(query);
  const hintedCategories = inferCategoriesFromQuery(query);
  const signals = analyzeQuery(query);
  // Hand-written synonyms stay a *weak* signal: they are added as plain words,
  // never as anchors or phrases. The embedding carries the real meaning.
  const expanded = new Set(signals.tokens);
  for (const token of signals.tokens) {
    for (const synonym of QUERY_SYNONYMS[token] ?? []) expanded.add(synonym);
  }
  signals.tokens = [...expanded];

  const docs: RankDoc[] = memories.map((m) => ({
    id: m.id,
    content: m.content,
    context: m.context,
    category: m.category,
    importance: m.importance,
  }));
  const df = buildDf(docs);

  // ---- Keyword evidence ------------------------------------------------
  const keywordHits: Hit[] = [];
  const keywordTier = new Map<string, number>();
  for (const [i, doc] of docs.entries()) {
    const match = scoreMatch(doc, signals, df, docs.length, hintedCategories);
    if (!match.qualified) continue;
    const strong = match.bigramHits > 0 || match.anchorHits > 0;
    keywordHits.push({ memory: memories[i], score: match.score, source: "keyword" });
    keywordTier.set(doc.id, strong ? 0 : 1);
  }
  const maxKeyword = Math.max(1e-6, ...keywordHits.map((h) => h.score));
  for (const hit of keywordHits) hit.score /= maxKeyword; // comparable with cosine
  keywordHits.sort((a, b) => b.score - a.score);

  // ---- Semantic evidence ----------------------------------------------
  const semanticHits: Hit[] = [];
  if (settings.semanticSearch !== false && !nonEnglish) {
    try {
      const vectors = (await withTimeout(getVectorsByProfile(profileId), 3000)) ?? [];
      if (vectors.length > 0) {
        const queryVector = await embedQuery(query);
        if (queryVector) {
          for (const vector of vectors) {
            const similarity = cosine(queryVector, vector.vector);
            if (similarity < SEMANTIC_THRESHOLD) continue;
            const memory = memories.find((m) => m.id === vector.memoryId);
            if (!memory) continue;
            if (similarity < SEMANTIC_STRONG
              && isCompoundFalseFriend(signals.tokens, `${memory.content} ${memory.context ?? ""}`)) continue;
            semanticHits.push({ memory, score: similarity, source: "semantic" });
          }
          semanticHits.sort((a, b) => b.score - a.score);
        }
      }
    } catch {
      // No IndexedDB / no runtime / index not ready — semantic tier skipped.
    }
  }

  // ---- Fusion: meaning, then strong words, then weaker evidence ---------
  const strongSemantic = semanticHits.filter((h) => h.score >= SEMANTIC_STRONG);
  const weakSemantic = semanticHits.filter((h) => h.score < SEMANTIC_STRONG);
  const strongKeyword = keywordHits.filter((h) => keywordTier.get(h.memory.id) === 0);
  const weakKeyword = keywordHits.filter((h) => keywordTier.get(h.memory.id) === 1);

  const ordered: Hit[] = [
    ...strongSemantic,
    ...strongKeyword,
    ...weakSemantic,
    ...weakKeyword,
  ];

  const chosen = new Set<string>();
  const results: RetrievedMemory[] = [];
  for (const hit of ordered) {
    if (results.length >= limit) break;
    if (chosen.has(hit.memory.id)) continue;
    chosen.add(hit.memory.id);
    results.push({ ...hit.memory, score: hit.score, source: hit.source });
  }

  // ---- General fill ----------------------------------------------------
  // Non-English queries cannot be scored by the English-only model, so fill
  // from the profile's strongest facts and let the user decide in the card.
  if (results.length < limit && (settings.allowGeneralFallback !== false || nonEnglish)) {
    const fillers = memories
      .filter((m) => !chosen.has(m.id))
      .sort(priority)
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
