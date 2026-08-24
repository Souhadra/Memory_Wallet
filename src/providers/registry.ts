import type { AIProviderAdapter } from "./types";
import { chatgptAdapter } from "./chatgpt";
import { claudeAdapter } from "./claude";

export const PROVIDERS: AIProviderAdapter[] = [chatgptAdapter, claudeAdapter];

export function activeProvider(): AIProviderAdapter | null {
  return PROVIDERS.find((p) => p.detectPage()) ?? null;
}
