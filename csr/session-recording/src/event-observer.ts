// correlationId is optional so older SDK versions without it still record.
export type SdkEvent = { name: string; timestamp: number; correlationId?: string };

/**
 * The slice of `window.__confidence` this observer owns. Mirrors the SDK's `ConfidenceGlobal`
 * without depending on it; listeners get `unknown` because the publisher may be any SDK version.
 */
export type SdkEventsWindow = {
  __confidence?: { events?: { listeners: Set<(event: unknown) => void> } };
};

/** Subscribe to future SDK events only; no history is stored on the window. */
export function observeSdkEvents(onEvent: (event: SdkEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const confidence = ((window as SdkEventsWindow).__confidence ??= {});
  const events = (confidence.events ??= { listeners: new Set() });
  const listener = (event: unknown) => {
    if (!isSdkEvent(event)) return;
    const correlationId = typeof event.correlationId === 'string' ? event.correlationId : undefined;
    onEvent({ name: event.name, timestamp: event.timestamp, ...(correlationId && { correlationId }) });
  };
  events.listeners.add(listener);
  return () => events.listeners.delete(listener);
}

function isSdkEvent(value: unknown): value is SdkEvent {
  if (typeof value !== 'object' || value === null) return false;
  const { name, timestamp } = value as Record<string, unknown>;
  return typeof name === 'string' && typeof timestamp === 'number' && Number.isFinite(timestamp);
}
