import type { PreviewMemory, ShowMemoryRequestPayload } from "../../shared/messages";

const STYLE = `
* { box-sizing: border-box; }
.mw-overlay {
  position: fixed; top: 16px; right: 16px; z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.mw-card {
  width: 360px; max-height: calc(100vh - 32px);
  display: flex; flex-direction: column;
  background: #16161d; color: #ececf1;
  border: 1px solid #2e2e3a; border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  overflow: hidden; animation: mw-in .18s ease-out;
}
@keyframes mw-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.mw-head {
  flex: 0 0 auto;
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px; font-size: 13px; font-weight: 600; letter-spacing: .2px;
  color: #a5b4fc; text-transform: uppercase;
}
.mw-close {
  margin-left: auto; background: none; border: none; color: #6b7280;
  font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 6px;
}
.mw-close:hover { background: #26262f; color: #ececf1; }
/* Body scrolls; head/foot stay pinned so Deny/Allow are always reachable. */
.mw-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 16px 8px; }
.mw-lede { margin: 0 0 4px; font-size: 15px; line-height: 1.45; color: #ececf1; }
.mw-lede b { color: #fff; }
.mw-paused-note {
  margin: 0 0 12px; font-size: 12px; color: #fbbf24;
}
.mw-paused-note .dot { animation: mw-blink 1.2s infinite; }
@keyframes mw-blink { 50% { opacity: .25; } }
.mw-section { margin-bottom: 12px; }
.mw-label {
  font-size: 11px; font-weight: 600; letter-spacing: .6px;
  text-transform: uppercase; color: #8b8b98; margin-bottom: 5px;
}
.mw-profiles { display: flex; flex-wrap: wrap; gap: 6px; }
.mw-prof-chip {
  display: inline-flex; align-items: center; gap: 6px;
  background: #1d1d26; border: 1px solid #2b2b36; border-radius: 999px;
  padding: 6px 11px; font-size: 12.5px; font-weight: 600; color: #c9c9d4; cursor: pointer;
  transition: border-color .12s, background .12s;
}
.mw-prof-chip:hover { border-color: #3d3d52; }
.mw-prof-chip.selected { border-color: #6366f1; background: #23233a; color: #fff; }
.mw-list { margin: 0; padding: 0; list-style: none; }
.mw-list li {
  font-size: 13.5px; color: #c9c9d4; padding: 3px 0; display: flex; gap: 8px; align-items: center;
}
.mw-check { color: #34d399; font-weight: 700; }
.mw-preview-zone { min-height: 20px; }
.mw-preview { margin: 0; padding: 0; list-style: none; }
.mw-preview li { padding: 5px 0; border-bottom: 1px solid #1e1e28; }
.mw-preview li:last-child { border-bottom: none; }
.mw-prev-text {
  font-size: 12.5px; color: #a1a1b5; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.mw-preview li.general .mw-prev-text { color: #71717a; }
.mw-preview li.semantic .mw-prev-text { color: #93c5fd; }
.mw-cat {
  display: inline-block; margin-top: 2px;
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
  color: #818cf8;
}
.mw-cat.sem-tag { color: #60a5fa; }
.mw-cat.gen-tag { color: #fbbf24; }
.mw-preview-empty {
  font-size: 12.5px; color: #6b7280; font-style: italic; margin: 0;
}
.mw-reason {
  font-size: 13.5px; color: #b9b9c6; font-style: italic;
  background: #1d1d26; border-left: 3px solid #6366f1;
  padding: 8px 12px; border-radius: 0 8px 8px 0;
}
.mw-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.mw-badge {
  font-size: 11px; font-weight: 700; letter-spacing: .5px;
  padding: 3px 9px; border-radius: 99px;
  background: #12291f; color: #34d399; border: 1px solid #1e4634;
}
/* Compact segmented duration control. */
.mw-durations { display: flex; gap: 6px; }
.mw-duration {
  flex: 1; text-align: center; cursor: pointer;
  background: #1d1d26; border: 1px solid #2b2b36; border-radius: 9px;
  padding: 8px 4px; font-size: 12px; font-weight: 600; color: #c9c9d4;
}
.mw-duration:hover { border-color: #3d3d52; }
.mw-duration.selected { border-color: #6366f1; background: #23233a; color: #fff; }
.mw-foot {
  flex: 0 0 auto; display: flex; gap: 10px;
  padding: 12px 16px 16px; background: #16161d; border-top: 1px solid #26262f;
}
.mw-btn {
  flex: 1; padding: 10px 0; border-radius: 10px; border: none;
  font-size: 14px; font-weight: 600; cursor: pointer; transition: filter .12s;
}
.mw-btn:hover { filter: brightness(1.12); }
.mw-deny { background: #2b2b36; color: #ececf1; }
.mw-allow { background: #6366f1; color: #fff; }
.mw-brand {
  flex: 0 0 auto;
  padding: 0 16px 10px; font-size: 11px; color: #55555f;
  letter-spacing: .3px; background: #16161d;
}
`;

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
      const style = document.createElement("style");
      style.textContent = STYLE;
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
        .map((c) => `<li><span class="mw-check">✓</span>${labelFor(c)}</li>`)
        .join("");

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="mw-overlay">
          <div class="mw-card" role="dialog" aria-label="Memory Wallet access request">
            <div class="mw-head">🔐 Memory Request <button class="mw-close" title="Deny and close">✕</button></div>
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
