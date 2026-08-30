import type { MemoryCategory, MemoryRequest } from "../shared/types";
import { nowISO, uid } from "../shared/constants";
import {
  DEFAULT_AI_APPS,
  createDefaultProfiles,
} from "../shared/demoData";
import {
  ensureSeeded,
  getAIApplications,
  getProfiles,
  getRequests,
  getSettings,
  migrateIfNeeded,
  saveRequests,
} from "../shared/storage";
import { getAccessLevel, setAccessLevel } from "../shared/permissions";
import { inferCategoriesFromQuery, retrieveRelevantMemories } from "../shared/retrieval";
import {
  MSG,
  EMBED_MSG,
  type PreviewMemory,
  type InjectContextPayload,
  type QueryDetectedPayload,
  type RequestDecisionPayload,
  type ShowMemoryRequestPayload,
} from "../shared/messages";
import { buildContextBlock } from "../shared/contextBlock";
import {
  kickOffIndexing,
  handleEmbedResult,
  embedTexts,
  ensureOffscreen,
} from "./embeddingService";

/** Grants that last for the browser session and never touch stored permissions. */
const sessionGrants = new Set<string>();
/** Pending request id per tab (one at a time keeps the UX honest). */
const pendingByTab = new Map<number, string>();

function grantKey(appId: string, profileId: string) {
  return `${appId}:${profileId}`;
}

export function hasSessionGrant(appId: string, profileId: string): boolean {
  return sessionGrants.has(grantKey(appId, profileId));
}

export function addSessionGrant(appId: string, profileId: string): void {
  sessionGrants.add(grantKey(appId, profileId));
}

export function inferRequestedCategories(query: string): MemoryCategory[] {
  return inferCategoriesFromQuery(query);
}

async function logRequest(request: MemoryRequest): Promise<void> {
  const requests = await getRequests();
  requests.unshift(request);
  await saveRequests(requests);
}

async function updateLoggedRequest(requestId: string, patch: Partial<MemoryRequest>) {
  const requests = await getRequests();
  const idx = requests.findIndex((r) => r.id === requestId);
  if (idx !== -1) {
    requests[idx] = { ...requests[idx], ...patch };
    await saveRequests(requests);
  }
}

async function sendToTab(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Tab may have navigated away; nothing we can do in a prototype.
  }
}

interface HandleResult {
  outcome: "auto-approved" | "needs-approval" | "denied" | "no-profile" | "busy";
}

export async function handleQueryDetected(
  tabId: number,
  payload: QueryDetectedPayload,
): Promise<HandleResult> {
  try {
    // Keep the embedding index in sync (no-op when nothing changed).
    kickOffIndexing();

    if (pendingByTab.has(tabId)) return { outcome: "busy" };

    const settings = await getSettings();
    const activeProfileId = settings.activeProfileId;
    if (!activeProfileId) return { outcome: "no-profile" };

    const apps = await getAIApplications();
    const app = apps.find((a) => a.id === payload.appId);
    const appName = app?.name ?? payload.appId;

    const access = await getAccessLevel(payload.appId, activeProfileId);

    const baseRequest: MemoryRequest = {
      id: uid("req"),
      tabId,
      aiApplicationId: payload.appId,
      profileId: activeProfileId,
      query: payload.query,
      requestedCategories: inferRequestedCategories(payload.query),
      reason: `Help answer your question: "${truncate(payload.query, 80)}"`,
      status: "pending",
      duration: null,
      matchedMemoryIds: null,
      createdAt: nowISO(),
    };

    if (access === "deny") {
      await logRequest({ ...baseRequest, status: "denied", resolvedAt: nowISO() });
      return { outcome: "denied" };
    }

    // ALLOW permission or a standing session grant -> serve silently.
    if (access === "allow" || hasSessionGrant(payload.appId, activeProfileId)) {
      await approveAndInject(
        tabId,
        { ...baseRequest, status: "approved", resolvedAt: nowISO() },
        access === "allow" ? "always" : "session",
      );
      return { outcome: "auto-approved" };
    }

    // ASK -> show the permission modal.
    const profiles = await getProfiles();
    const profile = profiles.find((p) => p.id === activeProfileId);

    pendingByTab.set(tabId, baseRequest.id);
    await logRequest(baseRequest);

    // Pre-compute previews for EVERY profile so the card can switch profiles
    // instantly. Retrieval is local keyword scoring + general-context fill;
    // nothing is shared until the user allows.
    const previews: Record<string, PreviewMemory[]> = {};
    for (const p of profiles) {
      const mems = await retrieveRelevantMemories(payload.query, p.id, 3);
      previews[p.id] = mems.map((m) => ({
        content: m.content,
        category: m.category,
        source: m.source,
      }));
    }

    const showPayload: ShowMemoryRequestPayload = {
      requestId: baseRequest.id,
      appName,
      profileName: profile?.name ?? "Unknown",
      profileIcon: profile?.icon,
      requestedCategories: baseRequest.requestedCategories.length
        ? baseRequest.requestedCategories
        : ["other"],
      reason: baseRequest.reason,
      profiles: profiles.map((p) => ({ id: p.id, name: p.name, icon: p.icon })),
      selectedProfileId: activeProfileId,
      previews,
    };
    await sendToTab(tabId, { type: MSG.SHOW_MEMORY_REQUEST, payload: showPayload });
    return { outcome: "needs-approval" };
  } catch (e) {
    console.error("[Memory Wallet] handleQueryDetected failed", e);
    pendingByTab.delete(tabId);
    return { outcome: "no-profile" };
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function approveAndInject(
  tabId: number,
  request: MemoryRequest,
  duration: "once" | "session" | "always",
): Promise<void> {
  await updateLoggedRequest(request.id, {
    status: "approved",
    duration,
    resolvedAt: nowISO(),
  });

  const memories = await retrieveRelevantMemories(
    request.query,
    request.profileId,
    (await getSettings()).maxMemoriesPerRequest,
  );

  await updateLoggedRequest(request.id, {
    matchedMemoryIds: memories.map((m) => m.id),
  });

  if (memories.length === 0) {
    await sendToTab(tabId, {
      type: MSG.INJECT_CONTEXT,
      payload: {
        requestId: request.id,
        contextText: "",
        query: request.query,
        memoryCount: 0,
        profileName: "",
      } satisfies InjectContextPayload,
    });
    return;
  }
  const profiles = await getProfiles();
  const profileName =
    profiles.find((p) => p.id === request.profileId)?.name ?? "Unknown";

  const contextText = buildContextBlock(profileName, memories);

  await sendToTab(tabId, {
    type: MSG.INJECT_CONTEXT,
    payload: {
      requestId: request.id,
      contextText,
      query: request.query,
      memoryCount: memories.length,
      profileName,
    } satisfies InjectContextPayload,
  });
}

export async function handleRequestDecision(
  tabId: number,
  payload: RequestDecisionPayload,
): Promise<void> {
  const requests = await getRequests();
  const request = requests.find((r) => r.id === payload.requestId);
  pendingByTab.delete(tabId);
  if (!request || !request.tabId) return;

  if (payload.decision === "deny") {
    // One-off: denies this request only, regardless of selected profile.
    await updateLoggedRequest(request.id, { status: "denied", resolvedAt: nowISO() });
    await sendToTab(request.tabId, { type: MSG.REQUEST_DENIED, payload: { requestId: request.id } });
    return;
  }

  // Profile override: the user may have switched profiles in the card.
  let effectiveProfileId = request.profileId;
  if (payload.profileId && payload.profileId !== request.profileId) {
    const profiles = await getProfiles();
    if (profiles.some((p) => p.id === payload.profileId)) {
      effectiveProfileId = payload.profileId;
      await updateLoggedRequest(request.id, { profileId: effectiveProfileId });
    }
  }

  if (payload.duration === "always") {
    await setAccessLevel(request.aiApplicationId, effectiveProfileId, "allow");
  } else if (payload.duration === "session") {
    addSessionGrant(request.aiApplicationId, effectiveProfileId);
  }

  await approveAndInject(
    request.tabId,
    { ...request, profileId: effectiveProfileId },
    payload.duration,
  );
}

export async function injectIntoOpenTabs(): Promise<void> {
  try {
    // host_permissions make tab.url readable for our two supported sites,
    // so no "tabs" permission is needed.
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      const url = tab.url ?? "";
      if (!url.startsWith("https://chatgpt.com/") && !url.startsWith("https://claude.ai/")) {
        continue;
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"],
        });
        console.info(`[Memory Wallet] content script injected into tab ${tab.id}`);
      } catch {
        // Tab may be discarded or restricted; user can reload it manually.
      }
    }
  } catch {
    // chrome.tabs may be briefly unavailable during worker startup.
  }
}

export async function initBackground(): Promise<void> {
  await migrateIfNeeded();
  await ensureSeeded(DEFAULT_AI_APPS, createDefaultProfiles());
  void injectIntoOpenTabs();
  // Warm up the semantic index in the background (downloads the model on
  // first ever run; no-op afterwards). Never blocks anything.
  kickOffIndexing();

  // Offscreen -> background: route embedding results to waiting callers.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (handleEmbedResult(message)) {
      sendResponse({ ok: true });
    }
    return false; // synchronous
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      switch (message?.type) {
        case "PING": {
          sendResponse({ ok: true });
          break;
        }
        case MSG.QUERY_DETECTED: {
          const payload = message.payload as QueryDetectedPayload;
          console.info(
            `[Memory Wallet] query from ${payload.appId} (${payload.query.length} chars)`,
          );
          const result = await handleQueryDetected(sender.tab?.id ?? -1, payload);
          sendResponse(result);
          break;
        }
        case MSG.REQUEST_DECISION: {
          await handleRequestDecision(sender.tab?.id ?? -1, message.payload);
          sendResponse({ ok: true });
          break;
        }
        case EMBED_MSG.EMBED_QUERY: {
          // Offscreen never asks; ignore to prevent loops.
          if (sender.url?.includes("offscreen")) {
            sendResponse({ ok: false });
            break;
          }
          const vectors = await embedTexts(message.texts as string[], 4000);
          sendResponse(vectors ? { ok: true, vectors } : { ok: false });
          break;
        }
        case EMBED_MSG.EMBED_RESULT: {
          // Already handled by the dedicated listener above.
          break;
        }
        case EMBED_MSG.REBUILD_INDEX: {
          kickOffIndexing(true);
          sendResponse({ ok: true, started: true });
          break;
        }
        case EMBED_MSG.CLEAR_MODEL_CACHE: {
          const ok = await ensureOffscreen();
          if (!ok) {
            sendResponse({ ok: false });
            break;
          }
          try {
            const res = await chrome.runtime.sendMessage({ type: EMBED_MSG.CLEAR_MODEL_CACHE });
            sendResponse(res ?? { ok: false });
          } catch {
            sendResponse({ ok: false });
          }
          break;
        }
        default:
          sendResponse({ error: "unknown message" });
      }
    })();
    return true; // async sendResponse
  });
}
