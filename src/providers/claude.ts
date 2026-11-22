import type { AIProviderAdapter } from "./types";
import { readEditableText } from "./composerText";

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
const ASSISTANT_SELECTORS = [
  'div[data-testid="assistant-message"]',
  '.font-claude-response',
  '[data-testid="message-response"]',
];
const STOP_SELECTORS = ['button[aria-label*="Stop" i]', 'button[data-testid="stop-button"]'];

function firstMatch<T extends Element>(selectors: string[]): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
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
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, text);
  return squash(el.textContent ?? "").includes(squash(text.slice(0, Math.min(40, text.length))));
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
