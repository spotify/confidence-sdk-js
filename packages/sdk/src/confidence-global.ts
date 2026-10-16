/** The `window.__confidence` namespace shared between Confidence SDKs in the same page. */

export interface ConfidenceFlagEntry {
  variant: string;
  assignmentOrigin: string;
}

/** What the events SDK shares with browser integrations: never the payload or context. */
export interface TrackedEventNotice {
  name: string;
  timestamp: number;
  correlationId: string;
}

export interface ConfidenceGlobal {
  flags?: Record<string, ConfidenceFlagEntry>;
  events?: { listeners: Set<(event: TrackedEventNotice) => void> };
}

declare global {
  interface Window {
    __confidence?: ConfidenceGlobal;
  }
}
