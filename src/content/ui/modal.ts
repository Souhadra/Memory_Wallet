import type { PreviewMemory, ShowMemoryRequestPayload } from "../../shared/messages";
import { buildTokenStyleEl } from "../../ui/contentTokens";

/* Component-specific styles for the Web3-grade memory request signing modal.
   Token variables are injected via buildTokenStyleEl(). */
const MODAL_COMPONENT_CSS = `
* { box-sizing: border-box; }

.mw-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
  display: flex; align-items: flex-start; justify-content: flex-end;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: mw-fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

@keyframes mw-fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes mw-slideIn {
  from { opacity: 0; transform: translateY(-12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes mw-pulseDot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.35); opacity: 0.6; }
}

.mw-card {
  width: 380px; max-height: calc(100vh - 40px);
  display: flex; flex-direction: column;
  background: rgba(14, 16, 26, 0.95);
  background-image: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.05) 60%, transparent 100%);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  color: #f1f2f8;
  border: 1px solid rgba(99, 102, 241, 0.35);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06), 0 0 30px rgba(99, 102, 241, 0.18);
  overflow: hidden;
  animation: mw-slideIn 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mw-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.mw-brand-badge {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.6px;
  color: #a5b4fc; text-transform: uppercase;
}

.mw-badge-icon {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(6, 182, 212, 0.3) 100%);
  border: 1px solid rgba(99, 102, 241, 0.4);
  color: #fff;
}

.mw-close {
  background: none; border: none; color: #828599;
  font-size: 16px; cursor: pointer; padding: 4px 6px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: all 120ms;
}

.mw-close:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }

button:focus-visible, .mw-prof-chip:focus-visible, .mw-duration:focus-visible {
  outline: none; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.6);
}

.mw-body {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 14px 18px 10px;
  display: flex; flex-direction: column; gap: 12px;
}

.mw-body::-webkit-scrollbar { width: 6px; }
.mw-body::-webkit-scrollbar-thumb { background: #31344e; border-radius: 999px; }

/* Prompt Detection & Interception Box */
.mw-intercept-card {
  background: rgba(22, 25, 42, 0.7);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 4px;
}

.mw-intercept-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: #a5b4fc; letter-spacing: 0.5px;
}

.mw-paused-indicator {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; color: #f59e0b; font-weight: 600;
}

.mw-paused-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: #f59e0b;
  animation: mw-pulseDot 1.4s infinite;
}

.mw-prompt-quote {
  font-size: 12px; line-height: 1.4; color: #c8cad8;
  margin: 0; font-style: italic; word-break: break-word;
}

.mw-section { display: flex; flex-direction: column; gap: 6px; }

.mw-label {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px;
  text-transform: uppercase; color: #828599;
}

.mw-profiles { display: flex; flex-wrap: wrap; gap: 6px; }

.mw-prof-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #141522; border: 1px solid #232538; border-radius: 999px;
  padding: 5px 11px; font-size: 12px; font-weight: 600; color: #c8cad8; cursor: pointer;
  transition: all 120ms;
}

.mw-prof-chip:hover { border-color: #31344e; background: #1c1e30; color: #fff; }

.mw-prof-chip.selected {
  border-color: #6366f1; background: linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.15) 100%);
  color: #fff;
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
}

.mw-preview-zone {
  display: flex; flex-direction: column; gap: 6px;
}

.mw-preview {
  margin: 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 6px;
}

.mw-preview li {
  background: #141522; border: 1px solid #232538;
  border-radius: 10px; padding: 8px 10px;
  display: flex; flex-direction: column; gap: 4px;
  transition: border-color 120ms;
}

.mw-preview li:hover { border-color: #31344e; }
.mw-preview li.semantic { border-color: rgba(6, 182, 212, 0.3); background: rgba(6, 182, 212, 0.05); }

.mw-prev-text {
  font-size: 11.5px; color: #f1f2f8; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.mw-prev-meta {
  display: flex; align-items: center; gap: 6px;
}

.mw-cat {
  font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700;
  padding: 1px 5px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc;
}

.mw-cat.sem-tag { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }
.mw-cat.gen-tag { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

.mw-preview-empty {
  font-size: 11.5px; color: #828599; font-style: italic; margin: 0;
  padding: 8px; background: #141522; border-radius: 8px;
}

.mw-durations { display: flex; gap: 6px; }

.mw-duration {
  flex: 1; text-align: center; cursor: pointer;
  background: #141522; border: 1px solid #232538; border-radius: 8px;
  padding: 7px 4px; font-size: 11px; font-weight: 600; color: #c8cad8;
  transition: all 120ms;
}

.mw-duration:hover { border-color: #31344e; color: #fff; }

.mw-duration.selected {
  border-color: #6366f1; background: #191b32; color: #fff;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.25);
}

.mw-foot {
  flex: 0 0 auto; display: flex; gap: 8px;
  padding: 12px 18px 14px;
  background: rgba(14, 16, 26, 0.98);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mw-btn {
  flex: 1; padding: 10px 12px; border-radius: 10px; border: none;
  font-size: 12.5px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: all 120ms;
}

.mw-btn:active { transform: scale(0.98); }

.mw-deny {
  background: #1c1e30; color: #c8cad8;
  border: 1px solid #31344e;
}

.mw-deny:hover { background: #232538; color: #fff; }

.mw-allow {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.mw-allow:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.55);
}

.mw-shortcut-hint {
  font-size: 9.5px; opacity: 0.7; font-weight: 500;
  padding: 1px 4px; border-radius: 3px; background: rgba(0, 0, 0, 0.25);
}

.mw-brand-footer {
  flex: 0 0 auto;
  padding: 0 18px 10px; font-size: 10px; color: #4e5166;
  text-align: center; letter-spacing: 0.2px;
}
`;

/** Thin-line inline SVG for shadow-DOM templates. */
function svgIcon(name: "lock" | "x" | "check" | "zap" | "shield", size = 14): string {
  const paths: Record<string, string> = {
    lock:
      '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    shield:
      '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/>',
    zap:
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export interface DecisionPayload {
  decision: "deny" | "allow";
  duration: "once" | "session" | "always";
  /** Profile chip selected at decision time (may differ from active). */
  profileId?: string;
}

/**
 * MetaMask-Grade Sovereign Context Signing Modal rendered in Shadow DOM.
 * Supports hot profile switching, live relevance matching preview, and keyboard shortcuts (Enter / Esc).
 */
export class MemoryRequestModal {
  private host: HTMLDivElement | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;

  isOpen(): boolean {
    return this.host !== null;
  }

  show(payload: ShowMemoryRequestPayload): Promise<DecisionPayload> {
    return new Promise((resolve) => {
      if (this.host) {
        resolve({ decision: "deny", duration: "once" });
        return;
      }

      const host = document.createElement("div");
      host.id = "memory-wallet-request-root";
      const shadow = host.attachShadow({ mode: "open" });

      // Inject shared token stylesheet + component styles
      shadow.appendChild(buildTokenStyleEl());
      const style = document.createElement("style");
      style.textContent = MODAL_COMPONENT_CSS;
      shadow.appendChild(style);

      const container = document.createElement("div");

      const profiles =
        payload.profiles.length > 0
          ? payload.profiles
          : [{ id: payload.selectedProfileId, name: payload.profileName, icon: payload.profileIcon }];
      let selectedProfileId = payload.selectedProfileId;
      if (!profiles.some((p) => p.id === selectedProfileId)) {
        selectedProfileId = profiles[0]?.id ?? "";
      }
      const previews: Record<string, PreviewMemory[]> = payload.previews ?? {};

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="mw-overlay">
          <div class="mw-card" role="dialog" aria-label="Memory Wallet Signature Request">
            <div class="mw-head">
              <div class="mw-brand-badge">
                <span class="mw-badge-icon">${svgIcon("shield", 12)}</span>
                <span>Sign Memory Request</span>
              </div>
              <button class="mw-close" title="Reject and close (Esc)">${svgIcon("x", 14)}</button>
            </div>

            <div class="mw-body">
              <!-- Intercept Card -->
              <div class="mw-intercept-card">
                <div class="mw-intercept-header">
                  <span>${escapeHtml(payload.appName)} Requesting Context</span>
                  ${payload.paused ? `<span class="mw-paused-indicator"><span class="mw-paused-dot"></span> Paused</span>` : ""}
                </div>
                ${payload.reason ? `<p class="mw-prompt-quote">"${escapeHtml(truncatePreview(payload.reason, 140))}"</p>` : ""}
              </div>

              <!-- Profile Switcher Chips -->
              <div class="mw-section">
                <div class="mw-label">Target Persona Profile</div>
                <div class="mw-profiles">
                  ${profiles
                    .map(
                      (p) =>
                        `<button type="button" class="mw-prof-chip${p.id === selectedProfileId ? " selected" : ""}" data-pid="${escapeHtml(p.id)}"><span>${p.icon ?? "📁"}</span>${escapeHtml(p.name)}</button>`,
                    )
                    .join("")}
                </div>
              </div>

              <!-- Live Preview Zone -->
              <div class="mw-section mw-preview-zone"></div>

              <!-- Duration Selector -->
              <div class="mw-section">
                <div class="mw-label">Signature Scope</div>
                <div class="mw-durations">
                  <button type="button" class="mw-duration selected" data-value="once" title="Sign for this single prompt only">Once</button>
                  <button type="button" class="mw-duration" data-value="session" title="Sign until browser tab closes">Session</button>
                  <button type="button" class="mw-duration" data-value="always" title="Always auto-sign for this profile">Always</button>
                </div>
              </div>
            </div>

            <div class="mw-foot">
              <button class="mw-btn mw-deny" data-decision="deny">
                <span>Reject</span> <span class="mw-shortcut-hint">Esc</span>
              </button>
              <button class="mw-btn mw-allow" data-decision="allow">
                <span>${svgIcon("zap", 13)} Sign & Inject</span> <span class="mw-shortcut-hint">Enter</span>
              </button>
            </div>
            <div class="mw-brand-footer">Memory Wallet · 100% On-Device & Encrypted</div>
          </div>
        </div>
        `,
      );

      function renderList(items: PreviewMemory[]): string {
        return `<ul class="mw-preview">${items
          .map((p) => {
            const cls = p.source === "semantic" ? "semantic" : "";
            const tagCls = p.source === "semantic" ? " sem-tag" : p.source === "general" ? " gen-tag" : "";
            const tagText =
              p.source === "semantic"
                ? "Semantic Match"
                : p.source === "general"
                  ? "General Fallback"
                  : escapeHtml(p.category);
            return `<li${cls ? ` class="${cls}"` : ""}>
              <div class="mw-prev-text">${escapeHtml(truncatePreview(p.content))}</div>
              <div class="mw-prev-meta">
                <span class="mw-cat${tagCls}">${tagText}</span>
              </div>
            </li>`;
          })
          .join("")}</ul>`;
      }

      function renderPreview(): void {
        const zone = container.querySelector(".mw-preview-zone");
        if (!zone) return;
        const list = previews[selectedProfileId] ?? [];
        const nSemantic = list.filter((p) => p.source === "semantic").length;
        const nKeyword = list.filter((p) => p.source === "keyword").length;
        const nGeneral = list.filter((p) => p.source === "general").length;

        let label: string;
        let body: string;

        if (list.length === 0) {
          label = "Context Payload";
          body = `<p class="mw-preview-empty">No direct matches in this profile — question will be submitted without added memory context.</p>`;
        } else {
          const parts = [
            nKeyword ? `${nKeyword} keyword` : "",
            nSemantic ? `${nSemantic} semantic` : "",
            nGeneral ? `${nGeneral} general` : "",
          ].filter(Boolean);
          label = `Signing Context Payload (${parts.join(" · ") || `${list.length} items`})`;
          body = renderList(list);
        }

        zone.innerHTML = `<div class="mw-label">${label}</div>${body}`;
      }

      const finish = (result: DecisionPayload) => {
        if (this.keyListener) {
          window.removeEventListener("keydown", this.keyListener, true);
          this.keyListener = null;
        }
        host.remove();
        this.host = null;
        resolve(result);
      };

      const durationValue = (): DecisionPayload["duration"] =>
        (container.querySelector<HTMLElement>(".mw-duration.selected")?.dataset.value ??
          "once") as DecisionPayload["duration"];

      renderPreview();

      // Profile switcher click listeners
      container.querySelectorAll(".mw-prof-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const pid = (chip as HTMLElement).dataset.pid ?? "";
          if (pid === selectedProfileId) return;
          selectedProfileId = pid;
          container.querySelectorAll(".mw-prof-chip").forEach((x) =>
            x.classList.toggle("selected", (x as HTMLElement).dataset.pid === selectedProfileId),
          );
          renderPreview();
        });
      });

      // Duration selector click listeners
      container.querySelectorAll(".mw-duration").forEach((el) => {
        el.addEventListener("click", () => {
          container.querySelectorAll(".mw-duration").forEach((x) => x.classList.remove("selected"));
          el.classList.add("selected");
        });
      });

      // Close button
      container.querySelector(".mw-close")?.addEventListener("click", () =>
        finish({ decision: "deny", duration: durationValue(), profileId: selectedProfileId }),
      );

      // Deny / Allow buttons
      container.querySelectorAll(".mw-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          finish({
            decision: (btn as HTMLElement).dataset.decision as DecisionPayload["decision"],
            duration: durationValue(),
            profileId: selectedProfileId,
          });
        });
      });

      // Keyboard shortcuts: Enter to allow, Escape to deny
      this.keyListener = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          finish({ decision: "allow", duration: durationValue(), profileId: selectedProfileId });
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish({ decision: "deny", duration: durationValue(), profileId: selectedProfileId });
        }
      };
      window.addEventListener("keydown", this.keyListener, true);

      document.documentElement.appendChild(host);
      shadow.appendChild(container);
      this.host = host;
    });
  }

  close(): void {
    if (this.keyListener) {
      window.removeEventListener("keydown", this.keyListener, true);
      this.keyListener = null;
    }
    this.host?.remove();
    this.host = null;
  }
}

function truncatePreview(text: string, max = 110): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
