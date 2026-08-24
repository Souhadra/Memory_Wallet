const TOAST_STYLE = `
.mw-toast {
  position: fixed; bottom: 64px; left: 20px; z-index: 2147483647;
  display: flex; align-items: center; gap: 8px;
  background: #16161d; color: #ececf1; border: 1px solid #2e2e3a;
  border-radius: 10px; padding: 10px 14px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,.4);
  animation: mw-toast-in .18s ease-out;
}
@keyframes mw-toast-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.mw-pill {
  position: fixed; bottom: 20px; right: 20px; z-index: 2147483646;
  display: flex; align-items: center; gap: 6px;
  background: #16161dee; color: #ececf1; border: 1px solid #33334199;
  border-radius: 999px; padding: 8px 14px; cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 12.5px; font-weight: 600;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
  transition: transform .12s, border-color .12s;
}
.mw-pill:hover { transform: translateY(-2px); border-color: #6366f1; }
`;

let currentToast: HTMLDivElement | null = null;
let pillHost: HTMLDivElement | null = null;

export function showToast(message: string, tone: "info" | "success" | "warn" = "info"): void {
  currentToast?.remove();
  const host = document.createElement("div");
  host.id = "memory-wallet-toast-root";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = TOAST_STYLE;
  shadow.appendChild(style);

  const icon = tone === "success" ? "✅" : tone === "warn" ? "⚠️" : "🔐";
  const container = document.createElement("div");
  container.insertAdjacentHTML(
    "beforeend",
    `<div class="mw-toast"><span>${icon}</span><span>${message}</span></div>`,
  );
  shadow.appendChild(container);

  document.documentElement.appendChild(host);
  currentToast = host;
  window.setTimeout(() => {
    host.remove();
    if (currentToast === host) currentToast = null;
  }, 5000);
}

export function showPill(siteName: string): void {
  if (pillHost) return;
  const host = document.createElement("div");
  host.id = "memory-wallet-pill-root";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = TOAST_STYLE;
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.insertAdjacentHTML(
    "beforeend",
    `<button class="mw-pill" title="Memory Wallet — click to request context for your last question">🔐 ${siteName}</button>`,
  );
  container.querySelector("button")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("mw-pill-click"));
  });
  shadow.appendChild(container);

  document.documentElement.appendChild(host);
  pillHost = host;
}

export function removePill(): void {
  pillHost?.remove();
  pillHost = null;
}
