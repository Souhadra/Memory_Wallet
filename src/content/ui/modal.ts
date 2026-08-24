import type { ShowMemoryRequestPayload } from "../../shared/messages";

const STYLE = `
* { box-sizing: border-box; }
.mw-overlay {
  position: fixed; top: 16px; right: 16px; z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.mw-card {
  width: 360px; background: #16161d; color: #ececf1;
  border: 1px solid #2e2e3a; border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  overflow: hidden; animation: mw-in .18s ease-out;
}
@keyframes mw-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.mw-head {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px; font-size: 13px; font-weight: 600; letter-spacing: .2px;
  color: #a5b4fc; text-transform: uppercase;
}
.mw-close {
  margin-left: auto; background: none; border: none; color: #6b7280;
  font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 6px;
}
.mw-close:hover { background: #26262f; color: #ececf1; }
.mw-body { padding: 0 16px 16px; }
.mw-lede { margin: 0 0 12px; font-size: 15px; line-height: 1.45; color: #ececf1; }
.mw-lede b { color: #fff; }
.mw-section { margin-bottom: 12px; }
.mw-label {
  font-size: 11px; font-weight: 600; letter-spacing: .6px;
  text-transform: uppercase; color: #8b8b98; margin-bottom: 5px;
}
.mw-profile {
  display: inline-flex; align-items: center; gap: 8px;
  background: #22222c; border: 1px solid #33334133; border-radius: 9px;
  padding: 7px 12px; font-size: 14px; font-weight: 600;
}
.mw-list { margin: 0; padding: 0; list-style: none; }
.mw-list li {
  font-size: 13.5px; color: #c9c9d4; padding: 3px 0; display: flex; gap: 8px; align-items: center;
}
.mw-check { color: #34d399; font-weight: 700; }
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
.mw-durations { display: flex; flex-direction: column; gap: 7px; margin-top: 4px; }
.mw-duration {
  display: flex; align-items: center; gap: 9px; cursor: pointer;
  background: #1d1d26; border: 1px solid #2b2b36; border-radius: 9px;
  padding: 8px 11px; font-size: 13px; color: #c9c9d4;
}
.mw-duration.selected { border-color: #6366f1; background: #23233a; color: #fff; }
.mw-duration input { accent-color: #6366f1; }
.mw-foot { display: flex; gap: 10px; padding: 0 16px 16px; }
.mw-btn {
  flex: 1; padding: 10px 0; border-radius: 10px; border: none;
  font-size: 14px; font-weight: 600; cursor: pointer; transition: filter .12s;
}
.mw-btn:hover { filter: brightness(1.12); }
.mw-deny { background: #2b2b36; color: #ececf1; }
.mw-allow { background: #6366f1; color: #fff; }
.mw-brand {
  padding: 0 16px 12px; font-size: 11px; color: #55555f;
  letter-spacing: .3px;
}
`;

export interface DecisionPayload {
  decision: "deny" | "allow";
  duration: "once" | "session" | "always";
}

/**
 * Reusable, self-contained permission modal rendered in a shadow root
 * so host-site styles cannot leak in or out.
 */
export class MemoryRequestModal {
  private host: HTMLDivElement | null = null;

  isOpen(): boolean {
    return this.host !== null;
  }

  show(payload: ShowMemoryRequestPayload): Promise<DecisionPayload> {
    return new Promise((resolve) => {
      if (this.host) resolve({ decision: "deny", duration: "once" });

      const host = document.createElement("div");
      host.id = "memory-wallet-request-root";
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLE;
      shadow.appendChild(style);

      const container = document.createElement("div");

      const categoryItems = payload.requestedCategories
        .map((c) => `<li><span class="mw-check">✓</span>${labelFor(c)}</li>`)
        .join("");

      const icon = payload.profileIcon ?? "📁";

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="mw-overlay">
          <div class="mw-card" role="dialog" aria-label="Memory Wallet access request">
            <div class="mw-head">🔐 Memory Request <button class="mw-close" title="Deny and close">✕</button></div>
            <div class="mw-body">
              <p class="mw-lede"><b>${escapeHtml(payload.appName)}</b> is requesting access to your memory.</p>
              <div class="mw-section">
                <div class="mw-label">Profile</div>
                <div class="mw-profile"><span>${icon}</span>${escapeHtml(payload.profileName)}</div>
              </div>
              <div class="mw-section">
                <div class="mw-label">Requested information</div>
                <ul class="mw-list">${categoryItems}</ul>
              </div>
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
                  <label class="mw-duration selected" data-value="once"><input type="radio" name="mw-duration" value="once" checked>Once (this request only)</label>
                  <label class="mw-duration" data-value="session"><input type="radio" name="mw-duration" value="session">This session</label>
                  <label class="mw-duration" data-value="always"><input type="radio" name="mw-duration" value="always">Always allow for this profile</label>
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

      const finish = (result: DecisionPayload) => {
        host.remove();
        this.host = null;
        resolve(result);
      };

      const durationValue = (): DecisionPayload["duration"] =>
        (container.querySelector<HTMLInputElement>("input[name='mw-duration']:checked")?.value ??
          "once") as DecisionPayload["duration"];

      container.querySelectorAll(".mw-duration").forEach((el) => {
        el.addEventListener("click", () => {
          container.querySelectorAll(".mw-duration").forEach((x) => x.classList.remove("selected"));
          el.classList.add("selected");
          (el.querySelector("input") as HTMLInputElement).checked = true;
        });
      });
      container.querySelector(".mw-close")?.addEventListener("click", () => finish({ decision: "deny", duration: durationValue() }));
      container.querySelectorAll(".mw-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          finish({
            decision: (btn as HTMLElement).dataset.decision as DecisionPayload["decision"],
            duration: durationValue(),
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
