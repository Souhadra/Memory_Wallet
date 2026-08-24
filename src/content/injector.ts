import type { AIProviderAdapter } from "../providers/types";
import { getSettings } from "../shared/storage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface InjectionResult {
  filled: boolean;
  submitted: boolean;
}

/** Console diagnostics without any message content (selector-drift debugging). */
function logComposerDiagnostics(): void {
  const diag = {
    promptTextarea: !!document.querySelector("#prompt-textarea"),
    roleTextbox: document.querySelectorAll('[role="textbox"]').length,
    contenteditable: document.querySelectorAll("[contenteditable='true']").length,
    textareas: document.querySelectorAll("textarea").length,
  };
  console.info("[Memory Wallet] composer diagnostics:", JSON.stringify(diag));
}

/**
 * Fill the composer with the context block + original question.
 * Retries because the editor may be briefly unmounted during SPA updates.
 */
export async function injectContextIntoConversation(
  provider: AIProviderAdapter,
  contextText: string,
  originalQuery: string,
): Promise<InjectionResult> {
  const combined = `${contextText}\n\n${originalQuery}`;

  let filled = false;
  for (let attempt = 0; attempt < 3 && !filled; attempt++) {
    filled = provider.setComposerText(combined);
    if (!filled) await sleep(250);
  }

  if (!filled) {
    logComposerDiagnostics();
    try {
      await navigator.clipboard.writeText(combined);
    } catch {
      // Clipboard may be blocked without focus; nothing more we can do.
    }
    return { filled: false, submitted: false };
  }

  const settings = await getSettings();
  if (!settings.autoSendContext) return { filled: true, submitted: false };

  // Small delay lets the editor settle before clicking send.
  await sleep(250);
  let submitted = provider.submitComposer();
  if (!submitted) {
    await sleep(400);
    submitted = provider.submitComposer();
  }
  return { filled: true, submitted };
}

/** Put just the original question back into the composer and send it. */
export async function submitQuestion(
  provider: AIProviderAdapter,
  originalQuery: string,
): Promise<boolean> {
  let filled = false;
  for (let attempt = 0; attempt < 3 && !filled; attempt++) {
    filled = provider.setComposerText(originalQuery);
    if (!filled) await sleep(200);
  }
  if (!filled) {
    logComposerDiagnostics();
    return false;
  }
  await sleep(200);
  let submitted = provider.submitComposer();
  if (!submitted) {
    await sleep(400);
    submitted = provider.submitComposer();
  }
  return submitted;
}
