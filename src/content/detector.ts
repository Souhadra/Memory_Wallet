export const CONTEXT_MARKER = "[Memory Wallet Context]";
export const CONTEXT_END_MARKER = "[End Memory Wallet Context]";

interface DetectorCallbacks {
  /** Latest submitted user message from the conversation DOM. */
  getUserQuery: () => string | null;
  /** Current draft text in the composer. */
  getComposerText: () => string;
  /** Is this keyboard event targeting the composer? */
  isComposerTarget: (target: EventTarget | null) => boolean;
  /** Is this event target the site's send button? */
  isSendButton: (target: EventTarget | null) => boolean;
}

interface DetectorHandlers {
  /**
   * Synchronous check (cached setting): should we intercept sends at all?
   * Must be cheap — it runs inside capture-phase listeners.
   */
  shouldIntercept: () => boolean;
  /**
   * A user question needs wallet processing.
   * - paused=true: the send event was cancelled; the message is held.
   * - paused=false: the message already went out (fallback detection).
   */
  onQueryNeedsWallet: (query: string, paused: boolean) => void;
}

/**
 * Detects user messages with two strategies:
 *
 * 1. PRIMARY — intercept the send action itself (Enter / send-button click)
 *    in the capture phase so the message can be paused BEFORE submission.
 * 2. FALLBACK — a MutationObserver counting user-message bubbles, used when
 *    interception is disabled or the site uses non-standard send handling.
 */
export class QueryDetector {
  private observer: MutationObserver | null = null;
  private processedCount = 0;
  private lastQuery = "";
  private debounceTimer: number | null = null;

  constructor(private cb: DetectorCallbacks, private handlers: DetectorHandlers) {}

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
    this.handlers.onQueryNeedsWallet(this.lastQuery, false);
    return true;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    // Only real user input may be intercepted. Synthetic events (isTrusted
    // false) include our own programmatic re-sends after Deny/empty-preview;
    // intercepting those caused an endless pause → card → deny loop.
    if (!e.isTrusted) return;
    // IME composition (e.g. CJK input) — never touch.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key !== "Enter") return;
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) return; // newline
    if (!this.cb.isComposerTarget(e.target)) return;

    const draft = this.cb.getComposerText().trim();
    if (!draft || draft.includes(CONTEXT_MARKER)) return; // normal send, not our business
    if (!this.handlers.shouldIntercept()) return; // passthrough mode

    e.preventDefault();
    e.stopImmediatePropagation();
    this.lastQuery = draft;
    console.info(`[Memory Wallet] send intercepted (${draft.length} chars)`);
    this.handlers.onQueryNeedsWallet(draft, true);
  };

  private handleClick = (e: MouseEvent): void => {
    if (!e.isTrusted) return; // never intercept programmatic clicks (our re-sends)
    if (!this.cb.isSendButton(e.target)) return;

    const draft = this.cb.getComposerText().trim();
    if (!draft || draft.includes(CONTEXT_MARKER)) return;
    if (!this.handlers.shouldIntercept()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    this.lastQuery = draft;
    console.info(`[Memory Wallet] send intercepted (${draft.length} chars)`);
    this.handlers.onQueryNeedsWallet(draft, true);
  };

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

  /** Post-send detection (fallback mode). */
  private emit(snapshot: string): void {
    if (this.handlers.shouldIntercept()) return; // interception owns the flow
    let query = this.cb.getUserQuery() ?? snapshot;
    query = query.trim();
    if (!query) return;
    if (query.includes(CONTEXT_MARKER)) return; // our own injected send
    if (query === this.lastQuery && snapshot === "") return; // mutation echo
    this.lastQuery = query;
    console.info(`[Memory Wallet] question detected (${query.length} chars)`);
    this.handlers.onQueryNeedsWallet(query, false);
  }
}
