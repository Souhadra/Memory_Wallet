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

export const STORAGE_VERSION = 1;
export const STORAGE_VERSION_KEY = "mw_storage_version";

export const DEFAULT_SETTINGS: Settings = {
  localOnlyMode: true,
  autoSendContext: true,
  activeProfileId: null,
  maxMemoriesPerRequest: 5,
  showToolbarButton: true,
  pauseBeforeShare: true,
  allowGeneralFallback: false,
  semanticSearch: true,
  onboardingDone: false,
};

/** Keywords used to infer which memory categories a user query touches. */
export const CATEGORY_HINTS: Record<MemoryCategory, string[]> = {
  identity: [
    "who am i",
    "about me",
    "my name",
    "i am",
    // Education & study decisions.
    "masters",
    "postgrad",
    "phd",
    "study",
    "education",
    "degree",
    "college",
    "university",
    "graduate",
    "student",
  ],
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
  work: [
    "work",
    "job",
    "team",
    "company",
    "employer",
    "colleague",
    "meeting",
    // Career decisions.
    "career",
    "internship",
    "intern",
    "placement",
    "salary",
    "resume",
    "role",
    "hiring",
  ],
  personal: ["family", "friend", "hobby", "health", "weekend", "travel"],
  goal: [
    "goal",
    "plan",
    "milestone",
    "ambition",
    "next step",
    "objective",
    // Decision-type queries.
    "should i",
    "decide",
    "worth it",
    "future",
    "path",
  ],
  other: [],
};

/**
 * Single-word synonym expansion applied to query tokens before scoring, so
 * lexically distant but semantically close memories can match ("masters" →
 * education/degree/graduation). Values must be single words — they are
 * matched against memory tokens directly.
 */
export const QUERY_SYNONYMS: Record<string, string[]> = {
  masters: ["education", "degree", "graduation", "college"],
  postgrad: ["education", "degree", "graduation"],
  msc: ["education", "degree", "graduation"],
  phd: ["education", "research", "doctorate"],
  study: ["education", "studies", "college"],
  studying: ["education", "studies"],
  degree: ["education", "qualification"],
  college: ["education", "university"],
  university: ["education", "college"],
  graduate: ["graduation", "education"],
  job: ["work", "career", "employment"],
  jobs: ["work", "career"],
  intern: ["internship", "work", "experience"],
  internship: ["intern", "work", "experience"],
  placement: ["job", "career", "hiring"],
  salary: ["pay", "compensation", "work"],
  resume: ["cv", "career", "recruiter"],
  career: ["work", "profession"],
  quit: ["leave", "resign", "work"],
  hire: ["hiring", "recruit", "job"],
};

/** Ordering used when filling a request with general-context fallbacks. */
export const CATEGORY_PRIORITY: MemoryCategory[] = [
  "identity",
  "work",
  "project",
  "technical",
  "goal",
  "preference",
  "personal",
  "other",
];

export const DEMO_MARKER = "[demo]";

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
