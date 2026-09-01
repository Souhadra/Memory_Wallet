import { buildTokenStyleEl } from "../../ui/contentTokens";

/* Toast + Floating Pill styles for Memory Wallet.
   Token variables injected via buildTokenStyleEl(). */
const TOAST_COMPONENT_CSS = `
.mw-toast {
  position: fixed; bottom: 64px; left: 24px; z-index: 2147483647;
  display: flex; align-items: center; gap: 10px;
  background: rgba(14, 16, 26, 0.95);
  background-image: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 80%);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  color: #f1f2f8; border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 14px; padding: 10px 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(99, 102, 241, 0.2);
  animation: mw-toast-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes mw-toast-in {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.mw-toast svg { flex: 0 0 auto; }
.mw-toast.success svg { color: #10b981; }
.mw-toast.warn svg { color: #f59e0b; }
.mw-toast.info svg { color: #a5b4fc; }

.mw-pill {
  position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
  display: flex; align-items: center; gap: 7px;
  background: rgba(14, 16, 26, 0.92);
  background-image: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  color: #f1f2f8; border: 1px solid rgba(99, 102, 241, 0.4);
  border-radius: 999px; padding: 8px 16px; cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12.5px; font-weight: 700;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 12px rgba(99, 102, 241, 0.25);
  transition: all 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mw-pill:hover {
  transform: translateY(-2px) scale(1.02);
  border-color: #6366f1;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 20px rgba(99, 102, 241, 0.45);
}

.mw-pill:active {
  transform: scale(0.98);
}

.mw-pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.6);
}

.mw-pill svg { color: #a5b4fc; }
`;

/** Inline stroke icons (thin-line, currentColor) for shadow-DOM templates. */
function svgIcon(name: "lock" | "check" | "warn" | "zap", size = 15): string {
  const paths: Record<string, string> = {
    lock:
      '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    warn: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

let currentToast: HTMLDivElement | null = null;
let pillHost: HTMLDivElement | null = null;
let pillButton: HTMLButtonElement | null = null;

export function showToast(message: string, tone: "info" | "success" | "warn" = "info"): void {
  currentToast?.remove();
  const host = document.createElement("div");
  host.id = "memory-wallet-toast-root";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.appendChild(buildTokenStyleEl());
  const style = document.createElement("style");
  style.textContent = TOAST_COMPONENT_CSS;
  shadow.appendChild(style);

  const icon = svgIcon(tone === "success" ? "check" : tone === "warn" ? "warn" : "lock");
  const container = document.createElement("div");
  container.insertAdjacentHTML(
    "beforeend",
    `<div class="mw-toast ${tone}">${icon}<span>${message}</span></div>`,
  );
  shadow.appendChild(container);

  document.documentElement.appendChild(host);
  currentToast = host;
  window.setTimeout(() => {
    host.remove();
    if (currentToast === host) currentToast = null;
  }, 5000);
}

export function showPill(label: string): void {
  if (pillHost) {
    updatePill(label);
    return;
  }
  const host = document.createElement("div");
  host.id = "memory-wallet-pill-root";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.appendChild(buildTokenStyleEl());
  const style = document.createElement("style");
  style.textContent = TOAST_COMPONENT_CSS;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.insertAdjacentHTML(
    "beforeend",
    `<button class="mw-pill" title="Memory Wallet — Click to request context injection for your last prompt"></button>`,
  );
  pillButton = container.querySelector("button");
  pillButton?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("mw-pill-click"));
  });
  shadow.appendChild(container);

  document.documentElement.appendChild(host);
  pillHost = host;
  updatePill(label);
}

/** Update the pill label without recreating it (e.g. active profile changed). */
export function updatePill(label: string): void {
  if (!pillButton) return;
  pillButton.replaceChildren();
  pillButton.insertAdjacentHTML("afterbegin", svgIcon("zap", 13));
  const span = document.createElement("span");
  span.textContent = label;
  pillButton.appendChild(span);
}

export function removePill(): void {
  pillHost?.remove();
  pillHost = null;
  pillButton = null;
}
