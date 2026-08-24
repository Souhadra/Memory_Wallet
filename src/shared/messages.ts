export const MSG = {
  QUERY_DETECTED: "QUERY_DETECTED",
  SHOW_MEMORY_REQUEST: "SHOW_MEMORY_REQUEST",
  REQUEST_DECISION: "REQUEST_DECISION",
  INJECT_CONTEXT: "INJECT_CONTEXT",
  REQUEST_DENIED: "REQUEST_DENIED",
  CANCEL_REQUEST: "CANCEL_REQUEST",
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];

export interface QueryDetectedPayload {
  appId: string;
  query: string;
  url: string;
}

/** Background -> Content: show the permission modal. */
export interface ShowMemoryRequestPayload {
  requestId: string;
  appName: string;
  profileName: string;
  profileIcon?: string;
  requestedCategories: string[];
  reason: string;
}

/** Content -> Background: user made a decision. */
export interface RequestDecisionPayload {
  requestId: string;
  decision: "deny" | "allow";
  duration: "once" | "session" | "always";
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
