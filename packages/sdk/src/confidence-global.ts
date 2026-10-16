export interface ConfidenceFlagEntry {
  variant: string;
  assignmentOrigin: string;
}

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
