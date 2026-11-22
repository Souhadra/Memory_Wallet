/**
 * Retrieval eval for the on-device semantic tier.
 *
 * Embeds a small labelled set (scripts/fixtures/retrieval-eval.json) with the SAME bundled
 * model and settings the extension uses, then reports, for a range of similarity thresholds:
 *   - recall:    share of answerable queries where at least one relevant memory is shared
 *   - precision: share of shared memories that are relevant (answerable queries only)
 *   - false share: share of unanswerable queries that would still share something
 *   - avg shared: average number of memories shared per query
 * The row for the threshold currently in src/shared/retrieval.ts is marked with `<--`.
 *
 * Semantic similarity only: keyword matching (rank.ts) is not part of this score, so read it
 * as "what does the embedding tier alone contribute". Use it to pick a threshold with data
 * instead of by feel, and to catch regressions when the model or the threshold changes.
 *
 * Run (needs the model once: npm run fetch:model):   npm run eval:retrieval
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MODEL_DIR = resolve("models");
if (!existsSync(resolve(MODEL_DIR, "all-MiniLM-L6-v2", "onnx", "model_quantized.onnx"))) {
  console.error("Bundled model not found. Run `npm run fetch:model` first.");
  process.exit(1);
}

// Keep the eval in sync with the code it is measuring.
const retrievalSrc = readFileSync("src/shared/retrieval.ts", "utf8");
const constantsSrc = readFileSync("src/shared/constants.ts", "utf8");
const CURRENT_THRESHOLD = Number(/const SEMANTIC_THRESHOLD = ([0-9.]+)/.exec(retrievalSrc)?.[1] ?? "0.38");
const MAX_SHARED = Number(/maxMemoriesPerRequest: (\d+)/.exec(constantsSrc)?.[1] ?? "5");

const { pipeline, env } = await import("@huggingface/transformers");
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODEL_DIR.replaceAll("\\", "/") + "/";
env.useBrowserCache = false;
const extractor = await pipeline("feature-extraction", "all-MiniLM-L6-v2", { dtype: "q8" });
const embed = async (texts) => (await extractor(texts, { pooling: "mean", normalize: true })).tolist();

const data = JSON.parse(readFileSync("scripts/fixtures/retrieval-eval.json", "utf8"));
const memVecs = await embed(data.memories.map((m) => m.text));
const qVecs = await embed(data.queries.map((q) => q.q));
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

// Ranked similarities per query: [{ id, sim }] best first.
const ranked = qVecs.map((qv) =>
  data.memories.map((m, i) => ({ id: m.id, sim: dot(qv, memVecs[i]) })).sort((a, b) => b.sim - a.sim),
);

const answerable = data.queries.map((q, i) => ({ ...q, i })).filter((q) => q.relevant.length > 0);
const unanswerable = data.queries.map((q, i) => ({ ...q, i })).filter((q) => q.relevant.length === 0);

function at(threshold) {
  const shared = (i) => ranked[i].filter((r) => r.sim >= threshold).slice(0, MAX_SHARED);
  let hits = 0, relevantShared = 0, sharedTotal = 0, withShared = 0;
  for (const q of answerable) {
    const s = shared(q.i);
    if (s.some((r) => q.relevant.includes(r.id))) hits++;
    relevantShared += s.filter((r) => q.relevant.includes(r.id)).length;
    sharedTotal += s.length;
    if (s.length > 0) withShared++;
  }
  const falseShare = unanswerable.filter((q) => shared(q.i).length > 0).length;
  const allShared = data.queries.reduce((n, _, i) => n + shared(i).length, 0);
  return {
    recall: hits / answerable.length,
    precision: sharedTotal ? relevantShared / sharedTotal : NaN,
    falseShare: falseShare / unanswerable.length,
    avgShared: allShared / data.queries.length,
    withShared,
  };
}

const pct = (x) => (Number.isNaN(x) ? "  n/a" : `${(x * 100).toFixed(0).padStart(4)}%`);
console.log(`\nRetrieval eval: ${data.memories.length} memories, ${answerable.length} answerable + ${unanswerable.length} unanswerable queries`);
console.log(`Model all-MiniLM-L6-v2 (q8), top ${MAX_SHARED} above the threshold are shared\n`);
console.log("threshold  recall  precision  false-share  avg-shared");
const thresholds = [...new Set([0.15, 0.2, 0.25, 0.3, 0.35, CURRENT_THRESHOLD, 0.45, 0.5, 0.55].sort((a, b) => a - b))];
for (const t of thresholds) {
  const r = at(t);
  const mark = t === CURRENT_THRESHOLD ? "  <-- current" : "";
  console.log(`  ${t.toFixed(2)}     ${pct(r.recall)}   ${pct(r.precision)}      ${pct(r.falseShare)}        ${r.avgShared.toFixed(2)}${mark}`);
}

// Where does the model rank the right memory, regardless of any threshold?
const top1 = answerable.filter((q) => q.relevant.includes(ranked[q.i][0].id)).length;
console.log(`\nTop-1 is a relevant memory for ${top1}/${answerable.length} answerable queries (threshold-free).`);

const missed = answerable
  .filter((q) => !ranked[q.i].filter((r) => r.sim >= CURRENT_THRESHOLD).slice(0, MAX_SHARED).some((r) => q.relevant.includes(r.id)))
  .map((q) => {
    const best = Math.max(...q.relevant.map((id) => ranked[q.i].find((r) => r.id === id).sim));
    return { q: q.q, best };
  })
  .sort((a, b) => b.best - a.best);
console.log(`\nAnswerable queries that get nothing relevant at ${CURRENT_THRESHOLD.toFixed(2)} (${missed.length}/${answerable.length}), best relevant similarity first:`);
for (const m of missed.slice(0, 12)) console.log(`  ${m.best.toFixed(2)}  ${m.q}`);
if (missed.length > 12) console.log(`  ... and ${missed.length - 12} more`);
console.log("");
process.exit(0);
