import type { PreviewMemory, ShowMemoryRequestPayload } from "../../shared/messages";
import { buildTokenStyleEl } from "../../ui/contentTokens";

/* Component-specific styles for the memory request modal.
   Token variables are injected via buildTokenStyleEl(). */
const MODAL_COMPONENT_CSS = `
* { box-sizing: border-box; }

.mw-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483647;
  display: flex; align-items: flex-start; justify-content: flex-end;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: mw-fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes mw-fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes mw-slideIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }

.mw-card {
  width: 360px; max-height: calc(100vh - 32px);
  display: flex; flex-direction: column;
  background: rgba(21, 21, 32, 0.92);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  color: #ececf1;
  border: 1px solid #2e2e3e; border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.1);
  overflow: hidden;
  animation: mw-slideIn 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mw-head {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.3px;
  color: #a5b4fc; text-transform: uppercase;
}

.mw-head svg { color: #a5b4fc; }

.mw-close {
  margin-left: auto;
  background: none; border: none; color: #848494;
  font-size: 16px; cursor: pointer; padding: 4px 8px; border-radius: 8px;
  transition: background 120ms, color 120ms;
}

.mw-close:hover { background: #232330; color: #ececf1; }

button:focus-visible, .mw-prof-chip:focus-visible, .mw-duration:focus-visible {
  outline: none; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}

.mw-body {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  padding: 0 16px 8px;
}

.mw-body::-webkit-scrollbar { width: 8px; }
.mw-body::-webkit-scrollbar-thumb { background: #2e2e3e; border-radius: 999px; border: 2px solid #151520; }

.mw-lede { margin: 0 0 4px; font-size: 15px; line-height: 1.45; color: #ececf1; }
.mw-lede b { color: #fff; }

.mw-paused-note {
  margin: 0 0 12px; font-size: 12px; color: #fbbf24;
  display: flex; align-items: center; gap: 6px;
}

.mw-paused-note .dot { animation: mw-blink 1.2s infinite; }
@keyframes mw-blink { 50% { opacity: 0.25; } }

.mw-section { margin-bottom: 12px; }

.mw-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.6px;
  text-transform: uppercase; color: #848494; margin-bottom: 6px;
}

.mw-profiles { display: flex; flex-wrap: wrap; gap: 6px; }

.mw-prof-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #1a1a26; border: 1px solid #232330; border-radius: 999px;
  padding: 6px 12px; font-size: 12.5px; font-weight: 600; color: #c5c5d0; cursor: pointer;
  transition: border-color 120ms, background 120ms, box-shadow 120ms;
}

.mw-prof-chip:hover { border-color: #2e2e3e; background: #1e1e35; }

.mw-prof-chip.selected {
  border-color: #6366f1; background: #1e1e35; color: #fff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

.mw-list { margin: 0; padding: 0; list-style: none; }
.mw-list li {
  font-size: 13.5px; color: #c5c5d0; padding: 3px 0;
  display: flex; gap: 8px; align-items: center;
}

.mw-check { color: #34d399; font-weight: 700; display: inline-flex; flex: 0 0 auto; }

.mw-preview-zone { min-height: 20px; }

.mw-preview { margin: 0; padding: 0; list-style: none; }
.mw-preview li { padding: 6px 0; border-bottom: 1px solid #1c1c28; }
.mw-preview li:last-child { border-bottom: none; }

.mw-prev-text {
  font-size: 12.5px; color: #c5c5d0; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.mw-preview li.general .mw-prev-text { color: #71717a; }
.mw-preview li.semantic .mw-prev-text { color: #93c5fd; }

.mw-cat {
  display: inline-block; margin-top: 3px;
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;
  color: #818cf8;
}

.mw-cat.sem-tag { color: #60a5fa; }
.mw-cat.gen-tag { color: #fbbf24; }

.mw-preview-empty {
  font-size: 12.5px; color: #71717a; font-style: italic; margin: 0;
}

.mw-reason {
  font-size: 13.5px; color: #c5c5d0; font-style: italic;
  background: #1a1a26; border-left: 3px solid #6366f1;
  padding: 8px 12px; border-radius: 0 10px 10px 0;
  line-height: 1.45;
}

.mw-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.mw-badge {
  font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
  padding: 3px 10px; border-radius: 999px;
  background: #0f251d; color: #34d399; border: 1px solid #1b4032;
}

.mw-durations { display: flex; gap: 6px; }

.mw-duration {
  flex: 1; text-align: center; cursor: pointer;
  background: #1a1a26; border: 1px solid #232330; border-radius: 10px;
  padding: 8px 4px; font-size: 12px; font-weight: 600; color: #c5c5d0;
  transition: border-color 120ms, background 120ms, box-shadow 120ms;
}

.mw-duration:hover { border-color: #2e2e3e; }

.mw-duration.selected {
  border-color: #6366f1; background: #1e1e35; color: #fff;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.mw-foot {
  flex: 0 0 auto; display: flex; gap: 10px;
  padding: 12px 16px 16px;
  background: rgba(21, 21, 32, 0.95);
  border-top: 1px solid #232330;
}

.mw-btn {
  flex: 1; padding: 10px 0; border-radius: 12px; border: none;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: filter 120ms, background 120ms, box-shadow 120ms;
}

.mw-btn:hover { filter: brightness(1.1); }

.mw-deny {
  background: #232330; color: #ececf1;
  border: 1px solid #2e2e3e;
}

.mw-deny:hover { background: #2e2e3e; filter: none; }

.mw-allow {
  background: #6366f1; color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.mw-allow:hover { background: #7579f5; }

.mw-brand {
  flex: 0 0 auto;
  padding: 0 16px 10px; font-size: 11px; color: #50505e;
  letter-spacing: 0.3px; background: rgba(21, 21, 32, 0.95);
}
`;

/** Thin-line inline SVG for shadow-DOM templates. */
function svgIcon(name: "lock" | "x" | "check", size = 14): string {
  const paths: Record<string, string> = {
    lock:
      '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
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
 * Reusable, self-contained permission modal rendered in a shadow root
 * so host-site styles cannot leak in or out. Supports switching the
 * requested profile on the fly — the preview updates instantly.
 * The card never exceeds the viewport: body scrolls, Deny/Allow stay pinned.
 */
export class MemoryRequestModal {
  private host: HTMLDivElement | null = null;

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

      const categoryItems = payload.requestedCategories
        .map((c) => `<li><span class="mw-check">${svgIcon("check", 13)}</span>${labelFor(c)}</li>`)
        .join("");

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="mw-overlay">
          <div class="mw-card" role="dialog" aria-label="Memory Wallet access request">
            <div class="mw-head">${svgIcon("lock")} Memory Request <button class="mw-close" title="Deny and close">${svgIcon("x", 13)}</button></div>
            <div class="mw-body">
              <p class="mw-lede"><b>${escapeHtml(payload.appName)}</b> is requesting access to your memory.</p>
              ${payload.paused ? `<p class="mw-paused-note"><span class="dot">●</span> Your message is paused until you decide.</p>` : ""}
              <div class="mw-section">
                <div class="mw-label">Profile — tap to switch</div>
                <div class="mw-profiles">
                  ${profiles
                    .map(
                      (p) =>
                        `<button type="button" class="mw-prof-chip${p.id === selectedProfileId ? " selected" : ""}" data-pid="${escapeHtml(p.id)}"><span>${p.icon ?? "📁"}</span>${escapeHtml(p.name)}</button>`,
                    )
                    .join("")}
                </div>
              </div>
              <div class="mw-section">
                <div class="mw-label">Requested information</div>
                <ul class="mw-list">${categoryItems}</ul>
              </div>
              <div class="mw-section mw-preview-zone"></div>
              <div class="mw-section">
                <div class="mw-label">Reason</div>
                <div class="mw-reason">${escapeHtml(payload.reason)}</div>
              </div>
              <div class="mw-section">
                <div class="mw-meta"><span class="mw-badge">READ ONLY</span></div>
              </div>
              <div class="mw-section">
                <div class="mw-label">Duration</div>
                <div class="mw-durations">
                  <button type="button" class="mw-duration selected" data-value="once" title="Allow for this request only">Once</button>
                  <button type="button" class="mw-duration" data-value="session" title="Allow until the browser closes">Session</button>
                  <button type="button" class="mw-duration" data-value="always" title="Always allow this app for this profile">Always</button>
                </div>
              </div>
            </div>
            <div class="mw-foot">
              <button class="mw-btn mw-deny" data-decision="deny">Deny</button>
              <button class="mw-btn mw-allow" data-decision="allow">Allow</button>
            </div>
            <div class="mw-brand">Your AI memory. Your rules. · Nothing leaves this device.</div>
          </div>
        </div>
        `,
      );

      function renderList(items: PreviewMemory[]): string {
        return `<ul class="mw-preview">${items
          .map((p) => {
            const cls = p.source === "general" ? "general" : p.source === "semantic" ? "semantic" : "";
            const tagCls = p.source === "general" ? " gen-tag" : p.source === "semantic" ? " sem-tag" : "";
            const tagText =
              p.source === "general" || p.source === "semantic" ? p.source : escapeHtml(p.category);
            return `<li${cls ? ` class="${cls}"` : ""}><div class="mw-prev-text">${escapeHtml(truncatePreview(p.content))}</div><span class="mw-cat${tagCls}">${tagText}</span></li>`;
          })
          .join("")}</ul>`;
      }

      function renderPreview(): void {
        const zone = container.querySelector(".mw-preview-zone");
        if (!zone) return;
        const list = previews[selectedProfileId] ?? [];
        const nKeyword = list.filter((p) => p.source === "keyword").length;
        const nSemantic = list.filter((p) => p.source === "semantic").length;
        const nGeneral = list.filter((p) => p.source === "general").length;

        let label: string;
        let body: string;

        if (list.length === 0) {
          label = "Would share";
          body = `<p class="mw-preview-empty">No relevant memories matched in this profile — your question will be sent as-is if you allow.</p>`;
        } else if (nKeyword > 0) {
          const parts = [
            `${nKeyword} matched`,
            nSemantic ? `${nSemantic} semantic` : "",
            nGeneral ? `${nGeneral} general` : "",
          ].filter(Boolean);
          label = `Will share if you allow — ${parts.join(" · ")}`;
          body = renderList(list);
        } else if (nSemantic > 0) {
          const parts = [
            `${nSemantic} semantic ${nSemantic === 1 ? "match" : "matches"}`,
            nGeneral ? `${nGeneral} general` : "",
          ].filter(Boolean);
          label = `No keyword match — sharing ${parts.join(" · ")}`;
          body = renderList(list);
        } else {
          label = `No direct match — sharing ${nGeneral} general ${nGeneral === 1 ? "memory" : "memories"} from this profile`;
          body = renderList(list);
        }

        zone.innerHTML = `<div class="mw-label">${label}</div>${body}`;

        // Make passthrough explicit on the primary button too.
        const allowBtn = container.querySelector<HTMLButtonElement>(".mw-btn.mw-allow");
        if (allowBtn) {
          allowBtn.textContent =
            list.length === 0 ? "Allow (no memory matched)" : "Allow";
        }
      }

      const finish = (result: DecisionPayload) => {
        host.remove();
        this.host = null;
        resolve(result);
      };

      const durationValue = (): DecisionPayload["duration"] =>
        (container.querySelector<HTMLElement>(".mw-duration.selected")?.dataset.value ??
          "once") as DecisionPayload["duration"];

      renderPreview();

      container.querySelectorAll(".mw-prof-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const pid = (chip as HTMLElement).dataset.pid ?? "";
          if (pid === selectedProfileId) return;
          selectedProfileId = pid;
          container.querySelectorAll(".mw-prof-chip").forEach((x) =>
            x.classList.toggle("selected", (x as HTMLElement).dataset.pid === selectedProfileId),
          );
          renderPreview();
          // Bring the refreshed preview into view.
          container
            .querySelector(".mw-preview-zone")
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      });

      container.querySelectorAll(".mw-duration").forEach((el) => {
        el.addEventListener("click", () => {
          container.querySelectorAll(".mw-duration").forEach((x) => x.classList.remove("selected"));
          el.classList.add("selected");
        });
      });
      container.querySelector(".mw-close")?.addEventListener("click", () => finish({ decision: "deny", duration: durationValue(), profileId: selectedProfileId }));
      container.querySelectorAll(".mw-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          finish({
            decision: (btn as HTMLElement).dataset.decision as DecisionPayload["decision"],
            duration: durationValue(),
            profileId: selectedProfileId,
          });
        });
      });

      document.documentElement.appendChild(host);
      shadow.appendChild(container);
      this.host = host;
    });
  }

  close(): void {
    this.host?.remove();
    this.host = null;
  }
}

function labelFor(category: string): string {
  const labels: Record<string, string> = {
    identity: "Identity information",
    preference: "Preferences",
    project: "Current projects",
    technical: "Technology stack & technical details",
    work: "Work context",
    personal: "Personal context",
    goal: "Goals",
    other: "General context",
  };
  return labels[category] ?? category;
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
