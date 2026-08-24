/**
 * Minimal adapter interface so new AI sites can be added later
 * without touching detection / injection logic.
 */
export interface AIProviderAdapter {
  id: string;
  name: string;
  /** Returns true if this script is running on the provider's site. */
  detectPage(): boolean;
  /** Latest submitted user message text, or null. */
  detectUserQuery(): string | null;
  /** DOM node of the message composer input. */
  getComposer(): HTMLElement | null;
  /** Current draft text in the composer, "" if unavailable. */
  readComposerText(): string;
  /** Fill the composer with text (React-safe). */
  setComposerText(text: string): boolean;
  /** Click send, best effort. */
  submitComposer(): boolean;
  /** Is this event target the site's send button? */
  isSendButton(target: EventTarget | null): boolean;
}
