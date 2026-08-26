/* In-memory chrome.* stub + seeded wallet store for the visual harness.
   Must be imported BEFORE anything that touches chrome APIs. */

const now = () => new Date().toISOString();
const t = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString();

export const store: Record<string, unknown> = {
  mw_settings: {
    localOnlyMode: true,
    autoSendContext: true,
    activeProfileId: "profile-startup",
    maxMemoriesPerRequest: 4,
    showToolbarButton: true,
    pauseBeforeShare: true,
    allowGeneralFallback: true,
    semanticSearch: true,
    onboardingDone: true,
  },
  mw_profiles: [
    { id: "profile-startup", name: "Startup", icon: "🚀", description: "", createdAt: t(9000), updatedAt: t(9000) },
    { id: "profile-work", name: "Work", icon: "💼", description: "", createdAt: t(9000), updatedAt: t(9000) },
    { id: "profile-personal", name: "Personal", icon: "🏠", description: "", createdAt: t(9000), updatedAt: t(9000) },
  ],
  mw_memories: [
    { id: "m1", profileId: "profile-startup", content: "Building a Chrome extension called Memory Wallet — local-first AI memory with a permission-gated sharing model.", category: "project", importance: 0.9, createdAt: t(500), updatedAt: t(500) },
    { id: "m2", profileId: "profile-startup", content: "Prefers MV3 service-worker architecture and esbuild over webpack for tooling.", category: "technical", importance: 0.8, createdAt: t(480), updatedAt: t(480) },
    { id: "m3", profileId: "profile-startup", content: "Library chatbot side project: RAG pipeline with citation-first answers.", category: "project", importance: 0.7, createdAt: t(300), updatedAt: t(300) },
    { id: "m4", profileId: "profile-work", content: "Works as a full-stack developer; primary languages TypeScript and Python.", category: "work", importance: 0.85, createdAt: t(8000), updatedAt: t(8000) },
    { id: "m5", profileId: "profile-work", content: "Team uses GitHub Actions CI and trunk-based development.", category: "technical", importance: 0.6, createdAt: t(7000), updatedAt: t(7000) },
    { id: "m6", profileId: "profile-personal", content: "Lives in Berlin; prefers concise answers.", category: "personal", importance: 0.5, createdAt: t(8800), updatedAt: t(8800) },
    { id: "m7", profileId: "profile-personal", content: "Enjoys science fiction — favorite author is Ted Chiang.", category: "personal", importance: 0.4, createdAt: t(8600), updatedAt: t(8600) },
  ],
  mw_ai_applications: [
    { id: "chatgpt", name: "ChatGPT", domain: "chatgpt.com" },
    { id: "claude", name: "Claude", domain: "claude.ai" },
  ],
  mw_permissions: [
    { id: "perm1", aiApplicationId: "chatgpt", profileId: "profile-startup", access: "ask", createdAt: t(900), updatedAt: t(900) },
  ],
  mw_requests: [
    { id: "req1", aiApplicationId: "chatgpt", profileId: "profile-startup", query: "What architecture should I use for my library chatbot?", requestedCategories: ["project", "technical"], reason: "Question mentions an active project", status: "approved", duration: "once", matchedMemoryIds: ["m1", "m3"], createdAt: t(12), resolvedAt: t(12) },
    { id: "req2", aiApplicationId: "claude", profileId: "profile-work", query: "Summarize my current deployment setup.", requestedCategories: ["technical", "work"], reason: "Work-related question", status: "denied", duration: "once", matchedMemoryIds: null, createdAt: t(90), resolvedAt: t(89) },
    { id: "req3", aiApplicationId: "chatgpt", profileId: "profile-startup", query: "Remind me what I'm building.", requestedCategories: ["project"], reason: "Pill-triggered request", status: "pending", duration: null, matchedMemoryIds: ["m1"], createdAt: t(2) },
  ],
  mw_embed_status: { state: "ready", indexed: 7, total: 7 },
};

type Listener = Parameters<typeof chrome.storage.onChanged.addListener>[0];
const listeners = new Set<Listener>();

function get(keys: string | string[] | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const list = keys == null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
  for (const k of list) if (k in store) out[k] = JSON.parse(JSON.stringify(store[k]));
  return out;
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (keys: string | string[] | null) => get(keys),
      set: async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
        listeners.forEach((l) =>
          l(Object.fromEntries(Object.keys(obj).map((k) => [k, { newValue: obj[k] }])), "local"),
        );
      },
      remove: async (keys: string | string[]) => {
        for (const k of [].concat(keys as never)) delete store[k as string];
      },
    },
    onChanged: {
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
    },
  },
  runtime: {
    sendMessage: async () => ({ ok: true }),
    onMessage: { addListener: () => {}, removeListener: () => {} },
    getURL: (path: string) => path,
    openOptionsPage: () => {},
  },
  tabs: { create: () => {} },
};
