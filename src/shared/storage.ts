import type {
  AIApplication,
  Memory,
  MemoryCategory,
  MemoryRequest,
  Permission,
  Profile,
  WalletState,
} from "./types";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  STORAGE_VERSION,
  STORAGE_VERSION_KEY,
} from "./constants";

async function get<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function set<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("QUOTA_BYTES") || msg.toLowerCase().includes("quota")) {
      console.error("[Memory Wallet] storage quota exceeded for", key, e);
      throw new Error("Storage quota exceeded — try deleting some memories or profiles.");
    }
    throw e;
  }
}

/** Backfill missing settings keys after upgrades (no data loss). */
export async function migrateIfNeeded(): Promise<void> {
  const raw = await chrome.storage.local.get(STORAGE_VERSION_KEY);
  const current = (raw[STORAGE_VERSION_KEY] as number | undefined) ?? 0;
  if (current >= STORAGE_VERSION) return;

  // v0 → v1: ensure every DEFAULT_SETTINGS key exists.
  const existing = await get<Partial<WalletState["settings"]>>(STORAGE_KEYS.settings, {});
  const merged = { ...DEFAULT_SETTINGS, ...existing };
  // Only write if something was missing.
  const needsWrite = Object.keys(DEFAULT_SETTINGS).some(
    (k) => (existing as Record<string, unknown>)[k] === undefined,
  );
  if (needsWrite) await set(STORAGE_KEYS.settings, merged);

  await chrome.storage.local.set({ [STORAGE_VERSION_KEY]: STORAGE_VERSION });
}

export async function getProfiles(): Promise<Profile[]> {
  return get<Profile[]>(STORAGE_KEYS.profiles, []);
}
export async function saveProfiles(profiles: Profile[]): Promise<void> {
  await set(STORAGE_KEYS.profiles, profiles);
}

export async function getMemories(): Promise<Memory[]> {
  return get<Memory[]>(STORAGE_KEYS.memories, []);
}
export async function saveMemories(memories: Memory[]): Promise<void> {
  await set(STORAGE_KEYS.memories, memories);
}
export async function getMemoriesForProfile(profileId: string): Promise<Memory[]> {
  const all = await getMemories();
  return all
    .filter((m) => m.profileId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAIApplications(): Promise<AIApplication[]> {
  return get<AIApplication[]>(STORAGE_KEYS.aiApplications, []);
}
export async function saveAIApplications(apps: AIApplication[]): Promise<void> {
  await set(STORAGE_KEYS.aiApplications, apps);
}

export async function getPermissions(): Promise<Permission[]> {
  return get<Permission[]>(STORAGE_KEYS.permissions, []);
}
export async function savePermissions(perms: Permission[]): Promise<void> {
  await set(STORAGE_KEYS.permissions, perms);
}

export async function getRequests(): Promise<MemoryRequest[]> {
  return get<MemoryRequest[]>(STORAGE_KEYS.requests, []);
}
export async function saveRequests(requests: MemoryRequest[]): Promise<void> {
  // Keep the log bounded.
  await set(STORAGE_KEYS.requests, requests.slice(0, 100));
}

export async function getSettings() {
  const raw = await get<Partial<WalletState["settings"]>>(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...raw } as WalletState["settings"];
}
export async function saveSettings(settings: Partial<WalletState["settings"]>) {
  const current = await getSettings();
  await set(STORAGE_KEYS.settings, { ...current, ...settings });
}

/** Full state snapshot used by popup + dashboard. */
export async function getState(): Promise<WalletState> {
  const [profiles, memories, aiApplications, permissions, requests, settings] =
    await Promise.all([
      getProfiles(),
      getMemories(),
      getAIApplications(),
      getPermissions(),
      getRequests(),
      getSettings(),
    ]);
  return { profiles, memories, aiApplications, permissions, requests, settings };
}

export async function ensureSeeded(defaultApps: AIApplication[], defaultProfiles: Profile[]) {
  const apps = await getAIApplications();
  if (apps.length === 0) await saveAIApplications(defaultApps);

  const profiles = await getProfiles();
  if (profiles.length === 0 && defaultProfiles.length > 0) {
    await saveProfiles(defaultProfiles);
    await saveSettings({ activeProfileId: defaultProfiles[0].id });
  }
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.remove([...Object.values(STORAGE_KEYS), STORAGE_VERSION_KEY, "mw_embed_status"]);
  try {
    const { clearVectorStore } = await import("./vectorStore");
    await clearVectorStore();
  } catch {
    // IndexedDB may be unavailable (e.g. harness stub) — ignore.
  }
  try {
    indexedDB.deleteDatabase("memory-wallet-embeddings");
  } catch {
    // ignore
  }
}
