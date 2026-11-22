/**
 * Zero-dependency tests for the embedding pipeline's pure helpers.
 * Run via `npm test`.
 */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/shared/embedBudget.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node18",
  logLevel: "silent",
});
const code = bundle.outputFiles[0].text;
const { embedBudgetMs, isNoReceiverError, COLD_EMBED_BUDGET_MS, WARM_EMBED_BUDGET_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

check("a possibly-cold model gets a short budget, a warm one a generous budget", () => {
  assert.equal(embedBudgetMs(false), COLD_EMBED_BUDGET_MS);
  assert.equal(embedBudgetMs(true), WARM_EMBED_BUDGET_MS);
  assert.ok(COLD_EMBED_BUDGET_MS < WARM_EMBED_BUDGET_MS);
});

check("the cold budget keeps a held message from waiting on a model load", () => {
  assert.ok(COLD_EMBED_BUDGET_MS <= 2000);
});

check("'no receiver yet' errors are recognised (so the send is retried)", () => {
  assert.equal(isNoReceiverError(new Error("Could not establish connection. Receiving end does not exist.")), true);
  assert.equal(isNoReceiverError("Receiving end does not exist"), true);
});

check("other messaging errors are not retried", () => {
  assert.equal(isNoReceiverError(new Error("The message port closed before a response was received.")), false);
  assert.equal(isNoReceiverError(new Error("Extension context invalidated.")), false);
});

check("odd values do not throw", () => {
  assert.equal(isNoReceiverError(undefined), false);
  assert.equal(isNoReceiverError(null), false);
  assert.equal(isNoReceiverError({}), false);
});

console.log(`\n[embed-budget] OK — ${passed} checks passed\n`);
