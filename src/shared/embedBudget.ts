/**
 * Small pure helpers for the on-device embedding pipeline, kept free of chrome.* so they can
 * be unit tested.
 */

/** How long to wait for a query embedding once the model is known to be loaded. The wait
 *  can include queueing behind an index build, so it is generous. */
export const WARM_EMBED_BUDGET_MS = 6000;

/** How long to wait while the model may still be loading (first question after the browser
 *  or worker starts). A held message should not sit behind a cold model load: past this
 *  budget the question is answered from keyword matching and the model keeps loading in the
 *  background for the next one. */
export const COLD_EMBED_BUDGET_MS = 1500;

export function embedBudgetMs(modelKnownWarm: boolean): number {
  return modelKnownWarm ? WARM_EMBED_BUDGET_MS : COLD_EMBED_BUDGET_MS;
}

/** True for the error `chrome.runtime.sendMessage` throws when nothing is listening yet,
 *  e.g. the offscreen page was created a moment ago and has not registered its listener. */
export function isNoReceiverError(err: unknown): boolean {
  const message = typeof err === "string" ? err : String((err as { message?: unknown } | null)?.message ?? "");
  return /receiving end does not exist|could not establish connection/i.test(message);
}
