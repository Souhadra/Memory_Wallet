/**
 * Zero-dependency tests for what Enter does while the permission card is open.
 * Run via `npm test`.
 *
 * Regression: the card treated Enter anywhere as "Share & Send" with "Always" pre-selected,
 * so a stray second Enter, or Tab-to-Deny then Enter, created a standing grant.
 */
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["src/content/ui/cardKeys.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  target: "node18",
  logLevel: "silent",
});
const code = bundle.outputFiles[0].text;
const { enterAction, ENTER_GRACE_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${label}`);
}

check("Enter on a focused button is left to that button (Tab to Deny + Enter denies)", () => {
  for (const sinceShownMs of [0, 100, ENTER_GRACE_MS, 5000]) {
    assert.equal(enterAction({ sinceShownMs, focusOnControl: true, repeat: false }), "native");
  }
});

check("a stray second Enter right after the card appears does nothing", () => {
  assert.equal(enterAction({ sinceShownMs: 0, focusOnControl: false, repeat: false }), "swallow");
  assert.equal(enterAction({ sinceShownMs: ENTER_GRACE_MS - 1, focusOnControl: false, repeat: false }), "swallow");
});

check("a held Enter (auto-repeat) never allows, even after the grace period", () => {
  assert.equal(enterAction({ sinceShownMs: 10_000, focusOnControl: false, repeat: true }), "swallow");
});

check("a deliberate Enter on the card after the grace period still allows", () => {
  assert.equal(enterAction({ sinceShownMs: ENTER_GRACE_MS, focusOnControl: false, repeat: false }), "allow");
  assert.equal(enterAction({ sinceShownMs: 2500, focusOnControl: false, repeat: false }), "allow");
});

check("the grace period is short enough not to get in the way", () => {
  assert.ok(ENTER_GRACE_MS > 0 && ENTER_GRACE_MS <= 500);
});

console.log(`\n[card-keys] OK — ${passed} checks passed\n`);
