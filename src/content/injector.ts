import type { AIProviderAdapter } from "../providers/types";
import { getSettings } from "../shared/storage";

export interface InjectionResult {
  filled: boolean;
  submitted: boolean;
}

export async function injectContextIntoConversation(
  provider: AIProviderAdapter,
  contextText: string,
  originalQuery: string,
): Promise<InjectionResult> {
  const combined = `${contextText}\n\n${originalQuery}`;
  const filled = provider.setComposerText(combined);

  if (!filled) return { filled: false, submitted: false };

  const settings = await getSettings();
  if (!settings.autoSendContext) return { filled: true, submitted: false };

    // Small delay lets the editor settle before clicking send.
  await new Promise((r) => setTimeout(r, 250));
  const submitted = provider.submitComposer();
  return { filled: true, submitted };
}
