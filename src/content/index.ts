import type { AIProviderAdapter } from "../providers/types";
import { activeProvider } from "../providers/registry";
import { QueryDetector } from "./detector";
import { MemoryRequestModal } from "./ui/modal";
import { showToast, showPill, removePill } from "./ui/toast";
import { injectContextIntoConversation } from "./injector";
import {
  MSG,
  type DecisionLike,
  type InjectContextPayload,
  type QueryDetectedPayload,
} from "../shared/messages";

const provider = activeProvider();
if (provider) {
  initContentScript(provider);
}

function initContentScript(provider: AIProviderAdapter): void {
  const modal = new MemoryRequestModal();

  async function sendQuery(query: string) {
    const payload: QueryDetectedPayload = {
      appId: provider.id,
      query,
      url: location.href,
    };
    try {
      await chrome.runtime.sendMessage({ type: MSG.QUERY_DETECTED, payload });
      console.info("[Memory Wallet] query sent to wallet");
    } catch {
      showToast("Memory Wallet was reloaded — refresh this tab to reactivate it", "warn");
      removePill();
    }
  }

  const detector = new QueryDetector(
    {
      getUserQuery: () => provider.detectUserQuery(),
      getComposerText: () => provider.readComposerText(),
      isComposerTarget: (target) => {
        const composer = provider.getComposer();
        if (!composer || !(target instanceof Node)) return false;
        return composer.contains(target);
      },
    },
    (query) => {
      void sendQuery(query);
    },
  );

  detector.start();

  // Floating pill so the demo never depends on auto-detection alone.
  void chrome.storage.local.get("mw_settings").then((result) => {
    const settings = result["mw_settings"];
    if (!settings || settings.showToolbarButton !== false) showPill(provider.name);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes["mw_settings"]) {
      const s = changes["mw_settings"].newValue;
      if (s?.showToolbarButton === false) removePill();
      else showPill(provider.name);
    }
  });

  document.addEventListener("mw-pill-click", () => {
    if (modal.isOpen()) return;
    if (detector.forceEmit()) return;
    showToast("Ask a question first — then click the pill again", "info");
  });

  chrome.runtime.onMessage.addListener((message) => {
    switch (message?.type) {
      case MSG.SHOW_MEMORY_REQUEST: {
        if (modal.isOpen()) break;
        const requestPayload = message.payload;
        void modal.show(requestPayload).then((decision: DecisionLike) => {
          void chrome.runtime
            .sendMessage({
              type: MSG.REQUEST_DECISION,
              payload: { ...decision, requestId: requestPayload.requestId },
            })
            .catch(() => undefined);
          if (decision.decision === "deny") {
            showToast("Memory request denied", "warn");
          }
        });
        break;
      }
      case MSG.INJECT_CONTEXT: {
        const payload = message.payload as InjectContextPayload;
        if (!payload.contextText) {
          showToast("Memory Wallet: no relevant memories found in this profile");
          break;
        }
        void injectContextIntoConversation(
          provider,
          payload.contextText,
          payload.query,
        ).then((result) => {
          if (result.filled && result.submitted) {
            showToast(
              `Shared ${payload.memoryCount} memories from "${payload.profileName}" with ${provider.name}`,
              "success",
            );
          } else if (result.filled) {
            showToast(
              `Context inserted — review and press Enter to send (${payload.memoryCount} memories)`,
              "success",
            );
          } else {
            showToast("Could not reach the message box; context copied to clipboard", "warn");
          }
        });
        break;
      }
      case MSG.REQUEST_DENIED:
        modal.close();
        break;
      default:
        break;
    }
  });
}
