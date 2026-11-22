/**
 * What the Enter key should do while the permission card is open.
 *
 * The card listens for Enter on the whole window as a shortcut for "Share & Send". Two
 * things made that unsafe, and "Always" is pre-selected, so a stray Enter created a
 * standing grant:
 *   - a second Enter pressed right after the card appeared (or a held key) allowed at once
 *   - Enter on a focused button (Tab to Deny, then Enter) allowed instead of activating
 *     the button the user had focused
 *
 * Kept pure so it can be tested without a browser.
 */

/** Enter is ignored for this long after the card appears (stray double-Enter, held key). */
export const ENTER_GRACE_MS = 400;

export interface EnterContext {
  /** Milliseconds since the card was shown. */
  sinceShownMs: number;
  /** Keyboard focus is on a button inside the card. */
  focusOnControl: boolean;
  /** `KeyboardEvent.repeat`: the key is being held down. */
  repeat: boolean;
}

/**
 * - "native":  leave the event alone; the focused button handles Enter itself.
 * - "swallow": consume the key so it does nothing (and never reaches the page).
 * - "allow":   treat it as the Share & Send shortcut.
 */
export type EnterAction = "native" | "swallow" | "allow";

export function enterAction({ sinceShownMs, focusOnControl, repeat }: EnterContext): EnterAction {
  if (focusOnControl) return "native";
  if (repeat || sinceShownMs < ENTER_GRACE_MS) return "swallow";
  return "allow";
}
