import type { MemoryCategory, Settings } from "./types";

export const STORAGE_KEYS = {
  profiles: "mw_profiles",
  memories: "mw_memories",
  aiApplications: "mw_ai_applications",
  permissions: "mw_permissions",
  requests: "mw_requests",
  settings: "mw_settings",
} as const;

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "identity",
  "preference",
  "project",
  "technical",
  "work",
  "personal",
  "goal",
  "other",
];

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  identity: "Identity",
  preference: "Preferences",
  project: "Projects",
  technical: "Technical",
  work: "Work",
  personal: "Personal",
  goal: "Goals",
  other: "Other",
};

export const DEFAULT_SETTINGS: Settings = {
  localOnlyMode: true,
  autoSendContext: true,
  activeProfileId: null,
  maxMemoriesPerRequest: 5,
  showToolbarButton: true,
  pauseBeforeShare: true,
};

/** Keywords used to infer which memory categories a user query touches. */
export const CATEGORY_HINTS: Record<MemoryCategory, string[]> = {
  identity: ["who am i", "about me", "my name", "i am"],
  preference: [
    "prefer",
    "preference",
    "style",
    "concise",
    "like",
    "favorite",
    "favourite",
    "want me",
  ],
  project: [
    "project",
    "building",
    "current project",
    "working on",
    "startup",
    "product",
    "roadmap",
    "launch",
  ],
  technical: [
    "architecture",
    "stack",
    "technology",
    "framework",
    "language",
    "code",
    "database",
    "api",
    "react",
    "typescript",
    "python",
    "backend",
    "frontend",
    "deploy",
    "infrastructure",
    "library",
    "design pattern",
  ],
  work: ["work", "job", "team", "company", "employer", "colleague", "meeting"],
  personal: ["family", "friend", "hobby", "health", "weekend", "travel"],
  goal: ["goal", "plan", "milestone", "ambition", "next step", "objective"],
  other: [],
};

export const DEMO_MARKER = "[demo]";

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
