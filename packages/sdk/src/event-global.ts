import type { TrackedEventNotice } from './confidence-global';

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
        // A failing observer must not break tracking.
      }
    }
  } catch (_error) {
    // The host page owns window; never let it break tracking.
  }
}
