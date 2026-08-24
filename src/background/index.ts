import { initBackground } from "./orchestrator";

initBackground().catch((err) => {
  // Never log memory content; this only reports lifecycle failures.
  console.error("[Memory Wallet] background init failed", err);
});
