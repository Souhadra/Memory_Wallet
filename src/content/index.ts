import type { AIProviderAdapter } from "../providers/types";
import type { Settings } from "../shared/types";
import { activeProvider } from "../providers/registry";
import { QueryDetector } from "./detector";
import { ensureContentFont } from "./font";
import { PendingFlow } from "./pendingFlow";
import { showPill, removePill, showToast } from "./ui/toast";
import { isImporting } from "./importState";
import { startOneClickImport } from "./importFlow";
import {
  MSG,
  EMBED_MSG,
  type InjectContextPayload,
  type ShowMemoryRequestPayload,
} from "../shared/messages";

// Guard against double injection: the background re-executes this script on
// every service-worker cold start, and two live copies would each show their
// own modal and double-handle decisions. The flag lives in the isolated
// world for the page's lifetime.
const w = window as unknown as { __memoryWalletLoaded?: boolean };
if (!w.__memoryWalletLoaded) {
  w.__memoryWalletLoaded = true;
  const provider = activeProvider();
  if (provider) {
    initContentScript(provider);
  }
} else {
  console.info("[Memory Wallet] content script already active in this tab");
}

function initContentScript(provider: AIProviderAdapter): void {
  // Warm the bundled font before any permission card or toast renders.
  void ensureContentFont();

  // Start the on-device model loading now, so it is ready before the first question is sent.
  void chrome.runtime.sendMessage({ type: EMBED_MSG.WARMUP }).catch(() => undefined);

  // Cached settings so capture-phase listeners can decide synchronously.
  let settings: Partial<Settings> = {};

  async function refreshPill(): Promise<void> {
    if (settings.showToolbarButton === false) {
      removePill();
      return;
    }
    // Pill shows the ACTIVE PROFILE — what would be shared, not where you are.
    const res = await chrome.storage.local.get(["mw_settings", "mw_profiles"]);
    const profiles = (res["mw_profiles"] ?? []) as { id: string; name: string; icon?: string }[];
    const s = (res["mw_settings"] ?? {}) as Partial<Settings>;
    const profile = profiles.find((p) => p.id === s.activeProfileId);
    showPill(
      profile ? `${profile.icon ?? "📁"} ${profile.name}` : "no profile",
      () => { void startOneClickImport(provider); },
      provider.name,
    );
  }

  void chrome.storage.local.get("mw_settings").then((res) => {
    settings = (res["mw_settings"] as Partial<Settings>) ?? {};
    void refreshPill();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes["mw_settings"]) {
      settings = changes["mw_settings"].newValue ?? {};
    }
    if (changes["mw_settings"] || changes["mw_profiles"]) {
      void refreshPill();
    }
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
      shouldIntercept: () => settings.pauseBeforeShare !== false && !isImporting(),
      onQueryNeedsWallet: (query, paused) => {
        if (isImporting()) return; // our own prompt is not a user question
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

  // Navigating away or closing the tab abandons any open card. Tell the worker
  // immediately so the tab is not left "busy" until the pending entry expires.
  window.addEventListener("pagehide", () => {
    const requestId = flow.pendingRequestId;
    if (!requestId) return;
    void chrome.runtime
      .sendMessage({ type: MSG.CANCEL_REQUEST, payload: { requestId } })
      .catch(() => undefined);
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
