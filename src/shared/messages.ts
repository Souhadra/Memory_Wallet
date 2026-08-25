import type { MemorySource } from "./types";

export const MSG = {
  QUERY_DETECTED: "QUERY_DETECTED",
  SHOW_MEMORY_REQUEST: "SHOW_MEMORY_REQUEST",
  REQUEST_DECISION: "REQUEST_DECISION",
  INJECT_CONTEXT: "INJECT_CONTEXT",
  REQUEST_DENIED: "REQUEST_DENIED",
  CANCEL_REQUEST: "CANCEL_REQUEST",
} as const;

/** Internal embedding-pipeline messages (background <-> offscreen <-> UI). */
export const EMBED_MSG = {
  /** Any extension page -> background -> offscreen: embed these texts. */
  EMBED_QUERY: "MW_EMBED_QUERY",
  /** Offscreen -> background: vectors for a previous EMBED_QUERY. */
  EMBED_RESULT: "MW_EMBED_RESULT",
  /** Dashboard -> background: force a full index rebuild. */
  REBUILD_INDEX: "MW_REBUILD_INDEX",
  /** Dashboard -> background -> offscreen: delete cached model files. */
  CLEAR_MODEL_CACHE: "MW_CLEAR_MODEL_CACHE",
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface QueryDetectedPayload {
  appId: string;
  query: string;
  url: string;
}

export interface PreviewMemory {
  content: string;
  category: string;
  /** How this memory was selected for sharing. */
  source: MemorySource;
}

export interface ProfileChip {
  id: string;
  name: string;
  icon?: string;
}

/** Background -> Content: show the permission modal. */
export interface ShowMemoryRequestPayload {
  requestId: string;
  appName: string;
  profileName: string;
  profileIcon?: string;
  requestedCategories: string[];
  reason: string;
  /** True when the user's unsent message is being held pending this decision. */
  paused?: boolean;
  /** All profiles, so the user can switch before deciding. */
  profiles: ProfileChip[];
  /** Profile pre-selected in the card (the active one). */
  selectedProfileId: string;
  /** Top matching memories per profile id — preview only, shared after Allow. */
  previews: Record<string, PreviewMemory[]>;
}

/** Content -> Background: user made a decision. */
export interface RequestDecisionPayload {
  requestId: string;
  decision: "deny" | "allow";
  duration: "once" | "session" | "always";
  /** Profile selected in the card at decision time (may differ from active). */
  profileId?: string;
}

/** What the modal resolves with (requestId added by the caller). */
export type DecisionLike = { decision: "deny" | "allow"; duration: RequestDecisionPayload["duration"] };

/** Background -> Content: approved, here is the context. */
export interface InjectContextPayload {
  requestId: string;
  contextText: string;
  query: string;
  memoryCount: number;
  profileName: string;
}
