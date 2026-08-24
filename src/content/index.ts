import type { AIProviderAdapter } from "../providers/types";
import type { Settings } from "../shared/types";
import { activeProvider } from "../providers/registry";
import { QueryDetector } from "./detector";
import { PendingFlow } from "./pendingFlow";
import { showPill, removePill, showToast } from "./ui/toast";
import {
  MSG,
  type InjectContextPayload,
  type ShowMemoryRequestPayload,
} from "../shared/messages";

const provider = activeProvider();
if (provider) {
  initContentScript(provider);
}

function initContentScript(provider: AIProviderAdapter): void {
  // Cached settings so capture-phase listeners can decide synchronously.
  let settings: Partial<Settings> = {};
  void chrome.storage.local.get("mw_settings").then((res) => {
    settings = (res["mw_settings"] as Partial<Settings>) ?? {};
    if (settings.showToolbarButton !== false) showPill(provider.name);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes["mw_settings"]) return;
    settings = changes["mw_settings"].newValue ?? {};
    if (settings.showToolbarButton === false) removePill();
    else showPill(provider.name);
  });

  const flow = new PendingFlow(provider);

  const detector = new QueryDetector(
    {
      getUserQuery: () => provider.detectUserQuery(),
      getComposerText: () => provider.readComposerText(),
      isComposerTarget: (target) => {
        const composer = provider.getComposer();
        if (!composer || !(target instanceof Node)) return false;
        return composer.contains(target);
      },
      isSendButton: (target) => provider.isSendButton(target),
    },
    {
      shouldIntercept: () => settings.pauseBeforeShare !== false,
      onQueryNeedsWallet: (query, paused) => {
        if (!flow.canAcceptQuery()) {
          if (paused) {
            showToast("Memory Wallet is still handling your previous request", "info");
          }
          return;
        }
        void flow.begin(query, paused);
      },
    },
  );

  detector.start();

  document.addEventListener("mw-pill-click", () => {
    if (!flow.canAcceptQuery()) return;
    if (detector.forceEmit()) return;
    showToast("Ask a question first — then click the pill again", "info");
  });

  chrome.runtime.onMessage.addListener((message) => {
    switch (message?.type) {
      case MSG.SHOW_MEMORY_REQUEST:
        void flow.handleShowRequest(message.payload as ShowMemoryRequestPayload);
        break;
      case MSG.INJECT_CONTEXT:
        void flow.handleInjected(message.payload as InjectContextPayload);
        break;
      case MSG.REQUEST_DENIED:
        flow.handleDenied();
        break;
      default:
        break;
    }
  });
}
