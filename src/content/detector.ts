export const CONTEXT_MARKER = "[Memory Wallet Context]";
export const CONTEXT_END_MARKER = "[End Memory Wallet Context]";

interface DetectorCallbacks {
  /** Latest submitted user message from the conversation DOM. */
  getUserQuery: () => string | null;
  /** Current draft text in the composer (snapshot at send time). */
  getComposerText: () => string;
  /** Is this keyboard event targeting the composer? */
  isComposerTarget: (target: EventTarget | null) => boolean;
}

/**
 * Detects newly submitted user messages using two complementary triggers:
 *  1. Send actions (Enter / send-button click) with a composer text snapshot.
 *  2. A MutationObserver counting user-message bubbles as a safety net.
 * Deliberately simple so it is easy to repair when sites change markup.
 */
export class QueryDetector {
  private observer: MutationObserver | null = null;
  private processedCount = 0;
  private lastQuery = "";
  private debounceTimer: number | null = null;

  constructor(private cb: DetectorCallbacks, private onQuery: (query: string) => void) {}

  start(): void {
    this.processedCount = this.countMessages(); // ignore existing history
    this.observer = new MutationObserver(() => this.scheduleCheck());
    this.observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("keydown", this.handleKeydown, true);
    document.addEventListener("click", this.handleClick, true);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("keydown", this.handleKeydown, true);
    document.removeEventListener("click", this.handleClick, true);
  }

  get currentLastQuery(): string {
    return this.lastQuery;
  }

  /** Manually run the pipeline for the last known question (toolbar pill). */
  forceEmit(): boolean {
    if (!this.lastQuery) return false;
    this.onQuery(this.lastQuery);
    return true;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Enter") return;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) return; // newline
    if (!this.cb.isComposerTarget(e.target)) return;
    this.handlePotentialSend();
  };

  private handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest?.("button")) return;
    if (!this.cb.isComposerTarget(target)) return;
    this.handlePotentialSend();
  };

  private handlePotentialSend(): void {
    const snapshot = this.cb.getComposerText().trim();
    // The message usually appears shortly after sending; prefer DOM text,
    // fall back to the composer snapshot taken just before it cleared.
    window.setTimeout(() => this.emit(snapshot), 700);
  }

  private countMessages(): number {
    return document.querySelectorAll(
      'div[data-message-author-role="user"], div[data-testid="user-message"]',
    ).length;
  }

  private scheduleCheck(): void {
    if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.check(), 400);
  }

  private check(): void {
    const count = this.countMessages();
    if (count <= this.processedCount) return;
    this.processedCount = count;
    this.emit("");
  }

  private emit(snapshot: string): void {
    let query = this.cb.getUserQuery() ?? snapshot;
    query = query.trim();
    if (!query) return;
    if (query.includes(CONTEXT_MARKER)) return; // our own injected send
    if (query === this.lastQuery && snapshot === "") return; // mutation echo of same msg
    this.lastQuery = query;
    console.info(`[Memory Wallet] question detected (${query.length} chars)`);
    this.onQuery(query);
  }
}
