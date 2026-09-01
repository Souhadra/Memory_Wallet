import { buildTokenStyleEl } from "../../ui/contentTokens";

/* Toast + pill styles. Token variables injected via buildTokenStyleEl(). */
const TOAST_COMPONENT_CSS = `
.mw-toast {
  position: fixed; bottom: 64px; left: 20px; z-index: 2147483647;
  display: flex; align-items: center; gap: 8px;
  background: rgba(21, 21, 32, 0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: #ececf1; border: 1px solid #2e2e3e;
  border-radius: 12px; padding: 10px 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px; font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: mw-toast-in 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes mw-toast-in {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.mw-toast svg { flex: 0 0 auto; }
.mw-toast.success svg { color: #34d399; }
.mw-toast.warn svg { color: #fbbf24; }
.mw-toast.info svg { color: #a5b4fc; }

.mw-pill {
  position: fixed; bottom: 20px; right: 20px; z-index: 2147483646;
  display: flex; align-items: center; gap: 6px;
  background: rgba(21, 21, 32, 0.9);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: #ececf1; border: 1px solid rgba(46, 46, 62, 0.7);
  border-radius: 999px; padding: 8px 14px; cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12.5px; font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  transition: transform 120ms cubic-bezier(0.16, 1, 0.3, 1), border-color 120ms, box-shadow 120ms;
}

.mw-pill:hover {
  transform: translateY(-2px);
  border-color: #6366f1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.mw-pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}

.mw-pill svg { color: #a5b4fc; }
`;

/** Inline stroke icons (thin-line, currentColor) for shadow-DOM templates. */
function svgIcon(name: "lock" | "check" | "warn", size = 15): string {
  const paths: Record<string, string> = {
    lock:
      '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
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

  // Inject shared token stylesheet + component styles
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

  // Inject shared token stylesheet + component styles
  shadow.appendChild(buildTokenStyleEl());
  const style = document.createElement("style");
  style.textContent = TOAST_COMPONENT_CSS;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.insertAdjacentHTML(
    "beforeend",
    `<button class="mw-pill" title="Memory Wallet — click to request context for your last question"></button>`,
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
  pillButton.insertAdjacentHTML("afterbegin", svgIcon("lock", 13));
  const span = document.createElement("span");
  span.textContent = label;
  pillButton.appendChild(span);
}

export function removePill(): void {
  pillHost?.remove();
  pillHost = null;
  pillButton = null;
}
