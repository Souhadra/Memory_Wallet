import type { AccessLevel, Memory, MemoryCategory, Profile } from "./types";
import {
  clearAllData,
  getMemories,
  getProfiles,
  getSettings,
  saveMemories,
  saveProfiles,
  saveSettings,
} from "./storage";
import { DEMO_DATA, demoDescription } from "./demoData";
import { nowISO, uid } from "./constants";

export async function createProfile(
  name: string,
  description?: string,
  icon?: string,
): Promise<Profile> {
  const profiles = await getProfiles();
  const t = nowISO();
  const profile: Profile = {
    id: uid("profile"),
    name: name.trim(),
    description: description?.trim() || undefined,
    icon: icon || "📁",
    createdAt: t,
    updatedAt: t,
  };
  profiles.push(profile);
  await saveProfiles(profiles);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const profiles = await getProfiles();
  const p = profiles.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, patch, { updatedAt: nowISO() });
  await saveProfiles(profiles);
}

export async function deleteProfile(id: string): Promise<void> {
  const [profiles, memories] = await Promise.all([getProfiles(), getMemories()]);
  const remaining = profiles.filter((p) => p.id !== id);
  await saveProfiles(remaining);
  await saveMemories(memories.filter((m) => m.profileId !== id));

  // Cascade permissions + requests references are left for the log; permissions removed.
  const { getPermissions, savePermissions } = await import("./storage");
  const perms = await getPermissions();
  await savePermissions(perms.filter((p) => p.profileId !== id));

  const settings = await getSettings();
  if (settings.activeProfileId === id) {
    await saveSettings({ activeProfileId: remaining[0]?.id ?? null });
  }
}

export async function addMemory(input: {
  profileId: string;
  content: string;
  category: MemoryCategory;
  importance: number;
}): Promise<Memory> {
  const memories = await getMemories();
  const t = nowISO();
  const memory: Memory = {
    id: uid("mem"),
    profileId: input.profileId,
    content: input.content.trim(),
    category: input.category,
    importance: input.importance,
    createdAt: t,
    updatedAt: t,
  };
  memories.push(memory);
  await saveMemories(memories);
  return memory;
}

export async function updateMemory(id: string, patch: Partial<Memory>): Promise<void> {
  const memories = await getMemories();
  const m = memories.find((x) => x.id === id);
  if (!m) return;
  Object.assign(m, patch, { updatedAt: nowISO() });
  await saveMemories(memories);
}

export async function deleteMemory(id: string): Promise<void> {
  const memories = await getMemories();
  await saveMemories(memories.filter((m) => m.id !== id));
}

export async function setActiveProfile(profileId: string): Promise<void> {
  await saveSettings({ activeProfileId: profileId });
}

/**
 * Loads clearly-marked demo data. Safety guard: demo memories are only ever
 * added to EMPTY profiles — profiles that already contain memories (i.e.
 * real user data) are left untouched.
 */
export async function loadDemoData(): Promise<void> {
  const profiles = await getProfiles();
  const memories = await getMemories();
  let startupProfileId: string | null = null;
  let touched = false;

  for (const [name, specs] of Object.entries(DEMO_DATA)) {
    let profile = profiles.find((p) => p.name === name);
    if (!profile) {
      profile = {
        id: uid("profile"),
        name,
        description: demoDescription(),
        icon:
          name === "Startup" ? "🚀" : name === "Work" ? "💼" : name === "Personal" ? "🏠" : "📁",
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      profiles.push(profile);
    }
    const existingProfileMemories = memories.filter((m) => m.profileId === profile.id);
    if (existingProfileMemories.length > 0) {
      // Profile has real memories — never mix demo data into it.
      continue;
    }
    if (name === "Startup") startupProfileId = profile.id;

    const existingContents = new Set(existingProfileMemories.map((m) => m.content));
    for (const spec of specs) {
      if (existingContents.has(spec.content)) continue;
      const t = nowISO();
      memories.push({
        id: uid("mem"),
        profileId: profile.id,
        content: spec.content,
        category: spec.category,
        importance: spec.importance,
        createdAt: t,
        updatedAt: t,
      });
      touched = true;
    }
  }

  if (!touched) return; // nothing was empty — do not rewrite storage needlessly

  await saveProfiles(profiles);
  await saveMemories(memories);

  // Point the wallet at Startup so the demo flow works immediately.
  if (startupProfileId) await saveSettings({ activeProfileId: startupProfileId });
}

/** Reopen the first-run wizard on next dashboard open (data untouched). */
export async function reopenOnboarding(): Promise<void> {
  await saveSettings({ onboardingDone: false });
}

/** Wipe everything and restore defaults (used by Settings). */
export async function factoryReset(): Promise<void> {
  await clearAllData();
}

/* ------------------------------------------------------------------ */
/* ChatGPT memory import                                              */
/* ------------------------------------------------------------------ */

const MEMORY_TEXT_FIELDS = ["content", "text", "value", "title", "memory", "claim", "fact"];

/**
 * Extract memory strings from any reasonable JSON shape:
 * - array of strings
 * - array of objects (text taken from the first matching field)
 * - object with a memories/data/items array inside
 * - arbitrary nested objects (e.g. hand-written profile JSON): leaves are
 *   flattened into readable "Path › Subpath — Key: value" sentences.
 * Returns unique, non-empty strings.
 */
export function parseMemoryJson(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const list = normalizeToList(parsed);
  if (list.length > 0) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const text =
        typeof item === "string"
          ? item
          : item && typeof item === "object"
            ? firstTextField(item as Record<string, unknown>)
            : null;
      if (!text) continue;
      const cleaned = text.trim();
      if (cleaned.length < 3 || cleaned.length > 500) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
    }
    if (out.length > 0) return out;
  }

  return flattenNestedJson(parsed);
}

/* ------------------------ nested JSON flattening ------------------------ */

const isPrimitive = (v: unknown): boolean =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";
const isStringArray = (v: unknown): boolean =>
  Array.isArray(v) && (v.length === 0 || v.every(isPrimitive));

const ACRONYMS = new Set([
  "ai","ml","llm","llms","api","apis","iot","uvm","sva","rag","csv","pdf","ui","aws","erp",
]);

function humanize(key: string): string {
  return key
    .split("_")
    .map((seg) =>
      ACRONYMS.has(seg.toLowerCase()) ? seg.toUpperCase() : seg.replace(/^\w/, (c) => c.toUpperCase()),
    )
    .join(" ");
}

function pathLabel(path: string[]): string {
  return path.map(humanize).join(" › ");
}

function formatPair(key: string, value: unknown): string {
  const label = humanize(key);
  if (isStringArray(value)) {
    return `${label}: ${(value as string[]).join(", ")}`;
  }
  return `${label}: ${String(value)}`;
}

/**
 * Convert structured/nested JSON (like a hand-written profile export) into
 * human-readable memory sentences. Objects whose children are simple values
 * collapse into one sentence; deeper branches recurse into their own sentences.
 */
export function flattenNestedJson(parsed: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (text: string) => {
    const t = text.trim().replace(/\s+/g, " ");
    if (t.length < 8 || t.length > 700) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  const visitObject = (obj: Record<string, unknown>, path: string[]): void => {
    const entries = Object.entries(obj);
    const simple = entries.filter(([, v]) => isPrimitive(v) || isStringArray(v));
    const complex = entries.filter(([, v]) => !isPrimitive(v) && !isStringArray(v));

    if (complex.length === 0) {
      // Pure leaf object: collapse everything into one sentence.
      const pairs = entries.map(([k, v]) => formatPair(k, v)).join("; ");
      const prefix = pathLabel(path);
      push(prefix ? `${prefix} — ${pairs}` : pairs);
    } else {
      // Mixed branch: give each top-level list/scalar its own sentence.
      const prefix = pathLabel(path);
      for (const [k, v] of simple) {
        const pair = formatPair(k, v);
        push(prefix ? `${prefix} — ${pair}` : pair);
      }
    }
    for (const [key, value] of complex) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            visitObject(item as Record<string, unknown>, [...path, key]);
          }
        }
      } else if (value && typeof value === "object") {
        visitObject(value as Record<string, unknown>, [...path, key]);
      }
    }
  };

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    visitObject(parsed as Record<string, unknown>, []);
  } else if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object")
        visitObject(item as Record<string, unknown>, []);
    }
  }
  return out;
}

function normalizeToList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const key of ["memories", "data", "items", "results"]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
      // Nested one level deeper (e.g. {memories: {data: [...]}})
      if (value && typeof value === "object") {
        for (const inner of Object.values(value)) {
          if (Array.isArray(inner)) return inner;
        }
      }
    }
    // Single object that itself has text fields.
    if (firstTextField(parsed as Record<string, unknown>)) return [parsed];
  }
  return [];
}

function firstTextField(obj: Record<string, unknown>): string | null {
  for (const field of MEMORY_TEXT_FIELDS) {
    const v = obj[field];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  total: number;
}

/** Import parsed memory strings into a profile (dedup by content). */
export async function importMemoriesIntoProfile(
  profileId: string,
  contents: string[],
): Promise<ImportResult> {
  const { inferCategoriesFromQuery } = await import("./retrieval");
  const memories = await getMemories();
  const existing = new Set(
    memories.filter((m) => m.profileId === profileId).map((m) => m.content.toLowerCase()),
  );

  let imported = 0;
  let duplicates = 0;

  for (const content of contents) {
    const key = content.toLowerCase();
    if (existing.has(key)) {
      duplicates++;
      continue;
    }
    existing.add(key);
    const cats = inferCategoriesFromQuery(content);
    const t = nowISO();
    memories.push({
      id: uid("mem"),
      profileId,
      content,
      category: cats[0] ?? "other",
      importance: 0.7,
      createdAt: t,
      updatedAt: t,
    });
    imported++;
  }

  if (imported > 0) await saveMemories(memories);
  return { imported, duplicates, total: contents.length };
}
