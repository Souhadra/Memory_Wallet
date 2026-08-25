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
  saveRequests,
} from "../shared/storage";
import { getAccessLevel, setAccessLevel } from "../shared/permissions";
import { inferCategoriesFromQuery, retrieveRelevantMemories } from "../shared/retrieval";
import {
  MSG,
  type InjectContextPayload,
  type QueryDetectedPayload,
  type RequestDecisionPayload,
  type ShowMemoryRequestPayload,
} from "../shared/messages";
import { buildContextBlock } from "./contextBlock";

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

  // Compute a preview of which memories would be shared — shown in the
  // modal BEFORE the user decides. Preview retrieval stays local; nothing
  // is sent to the AI until Allow.
  const previewMemories = await retrieveRelevantMemories(
    payload.query,
    activeProfileId,
    3,
  );

  const showPayload: ShowMemoryRequestPayload = {
    requestId: baseRequest.id,
    appName,
    profileName: profile?.name ?? "Unknown",
    profileIcon: profile?.icon,
    requestedCategories: baseRequest.requestedCategories.length
      ? baseRequest.requestedCategories
      : ["other"],
    reason: baseRequest.reason,
    preview: previewMemories.map((m) => ({ content: m.content, category: m.category })),
  };
  await sendToTab(tabId, { type: MSG.SHOW_MEMORY_REQUEST, payload: showPayload });
  return { outcome: "needs-approval" };
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

  const contextText = buildContextBlock(profileName, memories.map((m) => m.content));

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
    await updateLoggedRequest(request.id, { status: "denied", resolvedAt: nowISO() });
    await sendToTab(request.tabId, { type: MSG.REQUEST_DENIED, payload: { requestId: request.id } });
    return;
  }

  if (payload.duration === "always") {
    await setAccessLevel(request.aiApplicationId, request.profileId, "allow");
  } else if (payload.duration === "session") {
    addSessionGrant(request.aiApplicationId, request.profileId);
  }

  await approveAndInject(request.tabId, request, payload.duration);
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
  await ensureSeeded(DEFAULT_AI_APPS, createDefaultProfiles());
  void injectIntoOpenTabs();

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
        default:
          sendResponse({ error: "unknown message" });
      }
    })();
    return true; // async sendResponse
  });
}
