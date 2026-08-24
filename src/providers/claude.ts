import type { AIProviderAdapter } from "./types";

const USER_MESSAGE_SELECTORS = [
  'div[data-testid="user-message"]',
  "div.font-claude-message",
  '[data-testid="conversation"] div.flex.flex-col.items-end',
];
const COMPOSER_SELECTORS = [
  "fieldset div[contenteditable='true']",
  "div[contenteditable='true'].ProseMirror",
  "main div[role='textbox']",
  "div[contenteditable='true'][aria-label]",
  "form textarea",
  "textarea[placeholder]",
];
const SEND_BUTTON_SELECTORS = [
  'button[aria-label="Send message"]',
  'button[data-testid="send-button"]',
  'button[aria-label*="Send" i]',
];

function firstMatch<T extends Element>(selectors: string[]): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

function setText(el: HTMLElement, text: string): boolean {
  el.focus();
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, text);
  return (el.textContent ?? "").includes(text.slice(0, Math.min(40, text.length)));
}

export const claudeAdapter: AIProviderAdapter = {
  id: "claude",
  name: "Claude",

  detectPage(): boolean {
    return location.hostname === "claude.ai";
  },

  detectUserQuery(): string | null {
    let last: Element | null = null;
    for (const sel of USER_MESSAGE_SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) last = nodes[nodes.length - 1];
    }
    return (last?.textContent ?? "").trim() || null;
  },

  getComposer(): HTMLElement | null {
    return firstMatch<HTMLElement>(COMPOSER_SELECTORS);
  },

  readComposerText(): string {
    const composer = this.getComposer();
    if (!composer) return "";
    if (composer instanceof HTMLTextAreaElement) return composer.value;
    return composer.textContent ?? "";
  },

  setComposerText(text: string): boolean {
    const composer = this.getComposer();
    if (!composer) return false;
    try {
      return setText(composer, text);
    } catch {
      return false;
    }
  },

  submitComposer(): boolean {
    for (const sel of SEND_BUTTON_SELECTORS) {
      const btn = document.querySelector<HTMLButtonElement>(sel);
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
    }
    return false;
  },

  isSendButton(target: EventTarget | null): boolean {
    const el = target instanceof Element ? target.closest("button") : null;
    if (!el) return false;
    for (const sel of SEND_BUTTON_SELECTORS) {
      try {
        if (el.matches(sel)) return true;
      } catch {
        // invalid selector — ignore
      }
    }
    return false;
  },
};
