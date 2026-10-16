import type { TrackedEventNotice } from './confidence-global';

/** Notify active browser integrations without retaining event history or payloads. */
export function publishTrackedEvent(event: TrackedEventNotice): void {
  if (typeof window === 'undefined') return;
  try {
    const listeners = window.__confidence?.events?.listeners;
    if (!listeners) return;
    // Snapshot subscribers so callbacks cannot extend this delivery by subscribing again.
    for (const listener of Array.from(listeners)) {
      try {
        listener({ ...event });
      } catch (_error) {
        // Observers must not interrupt tracking or delivery to other observers.
      }
    }
  } catch (_error) {
    // The shared browser namespace belongs to the host page; tracking must remain safe.
  }
}
