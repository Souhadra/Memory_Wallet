/**
 * Background-side embedding pipeline manager:
 *  - lazily creates the offscreen document that hosts the model
 *  - routes embed requests to it (with timeouts) and matches up results
 *  - keeps the vector index in sync with stored memories (hash diffing)
 *  - publishes status to chrome.storage for the dashboard
 *
 * Every failure path degrades silently: callers get `null` and retrieval
 * falls back to keyword/general tiers — the wallet never blocks on ML.
 */
import { getMemories } from "../shared/storage";
import {
  getAllVectors,
  putVectors,
  deleteVectors,
  hashContent,
} from "../shared/vectorStore";
import { nowISO } from "../shared/constants";
import { EMBED_MSG } from "../shared/messages";

const OFFSCREEN_URL = "offscreen/offscreen.html";

export interface EmbedStatus {
  state: "idle" | "downloading" | "ready" | "error";
  pct?: number;
  indexed?: number;
  total?: number;
  error?: string;
  updatedAt?: string;
}

export async function getEmbedStatus(): Promise<EmbedStatus> {
  const res = await chrome.storage.local.get("mw_embed_status");
  return res["mw_embed_status"] ?? { state: "idle" as const };
}

export async function setEmbedStatus(patch: Partial<EmbedStatus>): Promise<void> {
  const cur = await getEmbedStatus();
  await chrome.storage.local.set({ mw_embed_status: { ...cur, ...patch, updatedAt: nowISO() } });
}

export async function ensureOffscreen(): Promise<boolean> {
  try {
    if (await (chrome.offscreen as unknown as { hasDocument: () => Promise<boolean> }).hasDocument()) return true;
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["WORKERS" as unknown as chrome.offscreen.Reason],
      justification: "Run the local embedding model for semantic memory search",
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------ embed requests --------------------------- */

let seq = 0;
const pending = new Map<number, (vectors: number[][] | null) => void>();

export function handleEmbedResult(message: { type?: string; reqId?: number; ok?: boolean; vectors?: number[][] }): boolean {
  if (message?.type !== EMBED_MSG.EMBED_RESULT) return false;
  const resolve = pending.get(message.reqId ?? -1);
  pending.delete(message.reqId ?? -1);
  resolve?.(message.ok ? (message.vectors ?? null) : null);
  return true;
}

export function embedTexts(texts: string[], timeoutMs = 4000): Promise<number[][] | null> {
  if (texts.length === 0) return Promise.resolve([]);
  return (async () => {
    if (!(await ensureOffscreen())) return null;
    const reqId = ++seq;
    return new Promise<number[][] | null>((resolve) => {
      pending.set(reqId, resolve);
      void chrome.runtime
        .sendMessage({ type: EMBED_MSG.EMBED_QUERY, reqId, texts })
        .catch(() => undefined);
      setTimeout(() => {
        if (pending.has(reqId)) {
          pending.delete(reqId);
          resolve(null);
        }
      }, timeoutMs);
    });
  })();
}

/* ------------------------------ index upkeep ----------------------------- */

let indexing = false;

export async function ensureIndex(force = false): Promise<void> {
  if (indexing) return;
  indexing = true;
  try {
    const memories = await getMemories();
    const existing = await getAllVectors();
    const byId = new Map(existing.map((v) => [v.memoryId, v]));

    // Drop vectors for memories that no longer exist.
    const orphanIds = existing
      .filter((v) => !memories.some((m) => m.id === v.memoryId))
      .map((v) => v.memoryId);
    if (orphanIds.length > 0) await deleteVectors(orphanIds);

    // Re-embed missing or changed memories.
    const stale = memories.filter(
      (m) => force || !byId.has(m.id) || byId.get(m.id)!.contentHash !== hashContent(m.content),
    );

    if (stale.length === 0) {
      await setEmbedStatus({ state: "ready", indexed: memories.length, total: memories.length });
      return;
    }

    await setEmbedStatus({
      state: "downloading",
      indexed: memories.length - stale.length,
      total: memories.length,
    });

    for (let i = 0; i < stale.length; i += 16) {
      const batch = stale.slice(i, i + 16);
      // First call may include the one-time model download — generous timeout.
      const vectors = await embedTexts(
        batch.map((m) => m.content),
        120000,
      );
      if (!vectors) {
        await setEmbedStatus({
          state: "error",
          indexed: i,
          total: memories.length,
          error: "embedding unavailable (offline or model failed to load)",
        });
        return;
      }
      await putVectors(
        batch.map((m, j) => ({
          memoryId: m.id,
          profileId: m.profileId,
          vector: vectors[j] ?? [],
          contentHash: hashContent(m.content),
          updatedAt: nowISO(),
        })),
      );
      await setEmbedStatus({
        state: "downloading",
        indexed: i + batch.length,
        total: memories.length,
      });
    }

    await setEmbedStatus({ state: "ready", indexed: memories.length, total: memories.length });
  } finally {
    indexing = false;
  }
}

/** Fire-and-forget indexing for worker startup / post-mutation nudges. */
export function kickOffIndexing(force = false): void {
  void ensureIndex(force).catch(() => undefined);
}
