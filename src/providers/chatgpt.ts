import type { AIProviderAdapter } from "./types";
import { readEditableText } from "./composerText";

// Ordered fallbacks — ChatGPT's markup changes; try newest known first.
const USER_MESSAGE_SELECTORS = [
  // Current ChatGPT DOM (2026) uses data-* attributes, not author roles.
  '[data-user-message-bubble="true"]',
  'div[data-message-author-role="user"]',
  'article[data-testid^="conversation-turn"] div[data-message-author-role="user"]',
  '[data-testid="user-message"]',
];
const COMPOSER_SELECTORS = [
  "#prompt-textarea",
  "#mobile-composer-prompt",
  "main div[role='textbox']",
  "form div[contenteditable='true']",
  "div[contenteditable='true'][id]",
  "form textarea",
  "textarea[placeholder]",
];
const SEND_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'form button[type="submit"]',
  'button[aria-label*="Send" i]',
];
const ASSISTANT_SELECTORS = [
  // The assistant reply now lives in [data-dil-response], and no longer has
  // data-message-author-role. This selector drives one-click import's
  // "wait until the answer finished streaming" detector.
  "[data-dil-response]",
  'div[data-message-author-role="assistant"]',
  '[data-testid^="conversation-turn"] div[data-message-author-role="assistant"]',
];
const STOP_SELECTORS = [
  'button[data-testid="stop-button"]',
  'button[aria-label*="Stop" i]',
];

function firstMatch<T extends Element>(selectors: string[]): T | null {
  let fallback: T | null = null;
  for (const sel of selectors) {
    for (const el of document.querySelectorAll<T>(sel)) {
      if (!fallback) fallback = el;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== "hidden") {
        return el;
      }
    }
  }
  return fallback;
}

const squash = (s: string): string => s.replace(/\s+/g, "");

/** innerText keeps bullet line breaks; textContent flattens them. */
const textOf = (el: Element | null): string =>
  el instanceof HTMLElement ? el.innerText || el.textContent || "" : (el?.textContent ?? "");

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
  // ProseMirror-style contenteditable
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, text);
  return squash(el.textContent ?? "").includes(squash(text.slice(0, Math.min(40, text.length))));
}

export const chatgptAdapter: AIProviderAdapter = {
  id: "chatgpt",
  name: "ChatGPT",

  detectPage(): boolean {
    return location.hostname === "chatgpt.com" || location.hostname === "chat.openai.com";
  },

  detectUserQuery(): string | null {
    let last: Element | null = null;
    for (const sel of USER_MESSAGE_SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) last = nodes[nodes.length - 1];
    }
    // Some surfaces render only a truncated question but keep the raw payload
    // (including the wallet marker) on the turn element.
    const raw = last?.getAttribute("data-mw-raw") ?? textOf(last);
    return raw.trim() || null;
  },

  getComposer(): HTMLElement | null {
    return firstMatch<HTMLElement>(COMPOSER_SELECTORS);
  },

  readComposerText(): string {
    const composer = this.getComposer();
    if (!composer) return "";
    if (composer instanceof HTMLTextAreaElement) return composer.value;
    // textContent would glue paragraphs together and mangle multi-line drafts.
    return readEditableText(composer) || (composer.textContent ?? "");
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

  detectAssistantReply(): string | null {
    let last: Element | null = null;
    for (const sel of ASSISTANT_SELECTORS) {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length > 0) last = nodes[nodes.length - 1];
    }
    return textOf(last).trim() || null;
  },

  isGenerating(): boolean {
    return STOP_SELECTORS.some((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  },
};
