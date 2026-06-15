import { vi } from 'vitest';
import type { PortAdapter } from '../uploader/worker/core';

/**
 * In-memory `PortAdapter` for testing the worker `core.ts` directly without
 * a real `Worker`.
 *
 * - `tabSends(msg)` simulates a tab posting into the worker (synchronous).
 * - `received` captures everything the worker has posted back.
 * - `next(predicate)` polls until a matching message arrives, then returns it.
 *   The cursor advances on each call so successive `next()`s walk forward
 *   through the buffer rather than re-matching earlier messages.
 */
export interface MockPort {
  adapter: PortAdapter;
  tabSends: (message: unknown) => void;
  received: unknown[];
  next: <T = unknown>(predicate: (m: unknown) => boolean) => Promise<T>;
}

export function createMockPort(): MockPort {
  const received: unknown[] = [];
  let handler: ((data: unknown) => void) | null = null;
  let cursor = 0;
  const adapter: PortAdapter = {
    postMessage: message => received.push(message),
    onmessage: cb => {
      handler = cb;
    },
  };
  return {
    adapter,
    received,
    tabSends: message => {
      if (handler === null) {
        throw new Error('no handler registered yet — register the port first');
      }
      handler(message);
    },
    next: <T = unknown>(predicate: (m: unknown) => boolean): Promise<T> =>
      vi.waitFor(() => {
        for (let i = cursor; i < received.length; i++) {
          if (predicate(received[i])) {
            cursor = i + 1;
            return received[i] as T;
          }
        }
        throw new Error('no matching message yet');
      }),
  };
}
