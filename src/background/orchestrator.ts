import type { MemoryCategory, MemoryRequest } from "../shared/types";
import { nowISO, uid } from "../shared/constants";
import {
  DEFAULT_AI_APPS,
  createDefaultProfiles,
} from "../shared/demoData";
import {
  ensureSeeded,
  getAIApplications,
  getMemories,
  getProfiles,
  getRequests,
  getSettings,
  migrateIfNeeded,
  saveRequests,
} from "../shared/storage";
import { getAccessLevel, setAccessLevel } from "../shared/permissions";
import { canAutoApprove } from "../shared/consent";
import { inferCategoriesFromQuery, retrieveRelevantMemories } from "../shared/retrieval";
import {
  MSG,
  EMBED_MSG,
  type PreviewMemory,
  type InjectContextPayload,
  type QueryDetectedPayload,
  type RequestDecisionPayload,
  type ShowMemoryRequestPayload,
  type RevokeGrantPayload,
  type SaveImportedMemoriesPayload,
} from "../shared/messages";
import { buildContextBlock } from "../shared/contextBlock";
import {
  kickOffIndexing,
  handleEmbedResult,
  embedTexts,
  ensureOffscreen,
} from "./embeddingService";

/** Grants that last for the browser session and never touch stored permissions.
 *  Backed by chrome.storage.session: survives MV3 service-worker restarts,
 *  cleared automatically when the browser closes — matching the "Session" promise. */
const SESSION_GRANTS_KEY = "mw_session_grants";
/** Pending request id per tab (one at a time keeps the UX honest).
 *  Must live in storage.session, not a module-level Map: MV3 evicts the worker
 *  after ~30s idle, and a lost entry used to leave a tab permanently "busy"
 *  with no card and no way to recover. Entries also expire, so a tab that is
 *  closed or navigated away while the card is open self-heals. */
const PENDING_KEY = "mw_pending_requests";
const PENDING_TTL_MS = 30 * 1000;

interface PendingEntry {
  requestId: string;
  at: number;
}
type PendingMap = Record<string, PendingEntry>;

async function readPending(): Promise<PendingMap> {
  try {
    const res = await chrome.storage.session.get(PENDING_KEY);
    const raw = (res[PENDING_KEY] as PendingMap | undefined) ?? {};
    const cutoff = Date.now() - PENDING_TTL_MS;
    const live: PendingMap = {};
    for (const [tabId, entry] of Object.entries(raw)) {
      if (entry && entry.at >= cutoff) live[tabId] = entry;
    }
    return live;
  } catch {
    return {};
  }
}

async function setPending(tabId: number, requestId: string): Promise<void> {
  try {
    const map = await readPending();
    map[String(tabId)] = { requestId, at: Date.now() };
    await chrome.storage.session.set({ [PENDING_KEY]: map });
  } catch {
    // Session storage unavailable — the watchdog in the content script still
    // unblocks the tab, so failing here degrades UX but cannot wedge it.
  }
}

async function clearPending(tabId: number): Promise<void> {
  try {
    const map = await readPending();
    if (!(String(tabId) in map)) return;
    delete map[String(tabId)];
    await chrome.storage.session.set({ [PENDING_KEY]: map });
  } catch {
    // ignore
  }
}

async function hasPending(tabId: number): Promise<boolean> {
  return String(tabId) in (await readPending());
}

function grantKey(appId: string, profileId: string) {
  return `${appId}:${profileId}`;
}

async function readSessionGrants(): Promise<Set<string>> {
  try {
    const res = await chrome.storage.session.get(SESSION_GRANTS_KEY);
    return new Set((res[SESSION_GRANTS_KEY] as string[] | undefined) ?? []);
  } catch {
    return new Set();
  }
}

export async function hasSessionGrant(appId: string, profileId: string): Promise<boolean> {
  return (await readSessionGrants()).has(grantKey(appId, profileId));
}

export async function addSessionGrant(appId: string, profileId: string): Promise<void> {
  const grants = await readSessionGrants();
  grants.add(grantKey(appId, profileId));
  await chrome.storage.session.set({ [SESSION_GRANTS_KEY]: [...grants] });
}

async function removeSessionGrant(appId: string, profileId: string): Promise<void> {
  const grants = await readSessionGrants();
  if (!grants.delete(grantKey(appId, profileId))) return;
  await chrome.storage.session.set({ [SESSION_GRANTS_KEY]: [...grants] });
}

/**
 * "Stop auto-sharing" from the receipt. Drops both the persisted "allow" and
 * the session-only grant; an explicit "deny" is left alone (deny is a stronger
 * statement than "ask" and must not be weakened by a receipt click).
 */
export async function revokeStandingGrant(appId: string, profileId: string): Promise<void> {
  if ((await getAccessLevel(appId, profileId)) === "allow") {
    await setAccessLevel(appId, profileId, "ask");
  }
  await removeSessionGrant(appId, profileId);
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
  outcome: "auto-approved" | "needs-approval" | "denied" | "no-profile" | "no-memories" | "busy";
}

export async function handleQueryDetected(
  tabId: number,
  payload: QueryDetectedPayload,
): Promise<HandleResult> {
  try {
    // Keep the embedding index in sync (no-op when nothing changed), and make sure the
    // model page still exists so semantic matching does not silently stop.
    kickOffIndexing();
    void ensureOffscreen();

    if (await hasPending(tabId)) return { outcome: "busy" };

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

    // A standing grant from the first Allow -> serve silently from now on.
    // An explicit "always ask" setting (or enterprise policy) wins.
    const hasGrant = await hasSessionGrant(payload.appId, activeProfileId);
    if (canAutoApprove({ access, hasStandingGrant: hasGrant, requireApproval: settings.requireApproval === true })) {
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

    await setPending(tabId, baseRequest.id);
    await logRequest(baseRequest);
    // Pre-compute previews for EVERY profile so the card can switch profiles
    // instantly. Retrieval is local keyword scoring + general-context fill;
    // nothing is shared until the user allows. Preview the same number that
    // approval will actually share so the card's count is never optimistic.
    const previewCount = Math.max(1, Math.min(settings.maxMemoriesPerRequest, 6));
    const previews: Record<string, PreviewMemory[]> = {};
    for (const p of profiles) {
      const mems = await retrieveRelevantMemories(payload.query, p.id, previewCount);
      previews[p.id] = mems.map((m) => ({
        content: m.content,
        category: m.category,
        source: m.source,
        context: m.context,
      }));
    }
    if (!Object.values(previews).some((items) => items.length > 0)) {
      // Asking permission to share nothing trains users to click Allow blindly.
      await clearPending(tabId);
      return { outcome: "no-memories" };
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
    return { outcome: "needs-approval" };  } catch (e) {
    console.error("[Memory Wallet] handleQueryDetected failed", e);
    await clearPending(tabId);
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
  const apps = await getAIApplications();
  const appName = apps.find((a) => a.id === request.aiApplicationId)?.name ?? request.aiApplicationId;
  const receiptMeta = {
    profileId: request.profileId,
    appName,
    duration,
    standingGranted: duration === "always" || duration === "session",
    requireApproval: (await getSettings()).requireApproval === true,
  };

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
        ...receiptMeta,
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
      ...receiptMeta,
    } satisfies InjectContextPayload,
  });
}

export async function handleRequestDecision(
  tabId: number,
  payload: RequestDecisionPayload,
): Promise<void> {
  const requests = await getRequests();
  const request = requests.find((r) => r.id === payload.requestId);
  await clearPending(tabId);
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
    await addSessionGrant(request.aiApplicationId, effectiveProfileId);
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
  // Keep the semantic index in sync in the background (a no-op when nothing
  // changed). The model ships in the package, so nothing is downloaded. Never
  // blocks anything.
  kickOffIndexing();
  // An already-built index never calls the model, so on a fresh browser it is
  // still unloaded. Warm it now: the first permission card should not have to
  // wait for a 23 MB wasm compile before it can rank by meaning.
  void embedTexts(["warmup"]).catch(() => undefined);

  // A card is only visible in the tab that asked for it. Navigating away or
  // closing that tab abandons the card, so release the pending slot at once —
  // otherwise the next question is silently sent without memory for up to the
  // TTL, and looks like the wallet randomly stopped working.
  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearPending(tabId);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // changeInfo.url is withheld for hosts we lack permissions for, so a
    // navigation away to an unrelated site would otherwise be invisible.
    // status:"loading" is always delivered and still means the card is gone.
    if (changeInfo.status === "loading" || changeInfo.url) void clearPending(tabId);
  });

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
          const result = await handleQueryDetected(sender.tab?.id ?? -1, payload);
          sendResponse(result);
          break;
        }
        case MSG.REQUEST_DECISION: {
          await handleRequestDecision(sender.tab?.id ?? -1, message.payload);
          sendResponse({ ok: true });
          break;
        }
        case MSG.CANCEL_REQUEST: {
          // Watchdog fired or the card was abandoned: release the tab so the
          // next question gets its own card instead of a silent passthrough.
          const tabId = sender.tab?.id ?? -1;
          await clearPending(tabId);
          const requestId = (message.payload as { requestId?: string } | undefined)?.requestId;
          if (requestId) {
            const requests = await getRequests();
            if (requests.some((r) => r.id === requestId && r.status === "pending")) {
              await updateLoggedRequest(requestId, { status: "cancelled", resolvedAt: nowISO() });
            }
          }
          sendResponse({ ok: true });
          break;
        }
        case MSG.REVOKE_GRANT: {
          const { appId, profileId } = message.payload as RevokeGrantPayload;
          await revokeStandingGrant(appId, profileId);
          sendResponse({ ok: true });
          break;
        }
        case MSG.SAVE_IMPORTED_MEMORIES: {
          const { proposals } = message.payload as SaveImportedMemoriesPayload;
          const settings = await getSettings();
          const profileId = settings.activeProfileId ?? (await getProfiles())[0]?.id;
          let saved = 0;
          if (profileId && Array.isArray(proposals)) {
            const { addMemory, updateMemory } = await import("../shared/actions");
            for (const p of proposals) {
              if (!p.content?.trim()) continue;

              if (p.kind === "update" && p.previous) {
                const choice = p.resolution ?? "new";
                if (choice === "old") continue;
                if (choice === "new") {
                  const previous = (await getMemories()).find((m) => m.id === p.previous!.id);
                  if (!previous) continue;
                  await updateMemory(previous.id, {
                    content: p.content.trim(),
                    category: p.category,
                    importance: p.importance,
                    context: p.context ?? previous.context,
                    previousValues: [...(previous.previousValues ?? []), previous.content],
                  });
                } else {
                  await addMemory({
                    profileId,
                    content: p.content.trim(),
                    category: p.category,
                    importance: p.importance,
                    origin: "ai-import",
                    context: p.context,
                  });
                }
                saved++;
                continue;
              }

              await addMemory({
                profileId,
                content: p.content.trim(),
                category: p.category,
                importance: p.importance,
                origin: "ai-import",
                context: p.context,
              });
              saved++;
            }
            kickOffIndexing(true);
          }
          sendResponse({ ok: saved > 0, saved });
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
        case EMBED_MSG.WARMUP: {
          // An AI tab opened. Make sure the model page exists (it starts loading the
          // model itself) so it is ready before the first question is sent.
          void ensureOffscreen();
          sendResponse({ ok: true });
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
