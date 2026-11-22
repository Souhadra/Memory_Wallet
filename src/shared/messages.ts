import type { MemoryCategory, MemorySource } from "./types";

export const MSG = {
  QUERY_DETECTED: "QUERY_DETECTED",
  SHOW_MEMORY_REQUEST: "SHOW_MEMORY_REQUEST",
  REQUEST_DECISION: "REQUEST_DECISION",
  INJECT_CONTEXT: "INJECT_CONTEXT",
  REQUEST_DENIED: "REQUEST_DENIED",
  CANCEL_REQUEST: "CANCEL_REQUEST",
  /** Content -> Background: drop a standing grant after the user sees a receipt. */
  REVOKE_GRANT: "REVOKE_GRANT",
  /** Content -> Background: save reviewed facts from the one-click import. */
  SAVE_IMPORTED_MEMORIES: "SAVE_IMPORTED_MEMORIES",
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
  /** Content script -> background: an AI tab opened, start the model loading now. */
  WARMUP: "MW_WARMUP",
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
  /** Section from an imported answer, shown as a chip in previews. */
  context?: string;
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
  profileId: string;
  profileName: string;
  appName: string;
  /** How this approval was reached, for the share receipt. */
  duration: "once" | "session" | "always";
  /** True when a standing grant now exists and can be revoked from the receipt. */
  standingGranted: boolean;
  /** Policy can force the card on even with a standing grant; be honest in the receipt. */
  requireApproval: boolean;
}

/** Content -> Background: revoke future silent sharing for an app + profile. */
export interface RevokeGrantPayload {
  appId: string;
  profileId: string;
}

export interface SaveImportedMemoriesPayload {
  proposals: {
    content: string;
    category: MemoryCategory;
    importance: number;
    context?: string;
    kind?: "new" | "update";
    previous?: { id: string; content: string; context?: string };
    /** Only present on update proposals: "new" | "old" | "both". */
    resolution?: "new" | "old" | "both";
  }[];
}
