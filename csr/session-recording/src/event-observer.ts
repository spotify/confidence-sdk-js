// correlationId is optional so older SDK versions without it still record.
type SdkEvent = { name: string; timestamp: number; correlationId?: string };

/** Subscribe to future SDK events only; no history is stored on the window. */
export function observeSdkEvents(onEvent: (event: SdkEvent) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const confidence = ((window as any).__confidence ??= {});
  const events = (confidence.events ??= { listeners: new Set<(event: SdkEvent) => void>() });
  const listener = (event: SdkEvent) => {
    if (!event || typeof event.name !== 'string' || !Number.isFinite(event.timestamp)) return;
    const correlationId = typeof event.correlationId === 'string' ? event.correlationId : undefined;
    onEvent({ name: event.name, timestamp: event.timestamp, ...(correlationId && { correlationId }) });
  };
  events.listeners.add(listener);
  return () => events.listeners.delete(listener);
}
