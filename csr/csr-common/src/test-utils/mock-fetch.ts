import { onTestFinished, vi } from 'vitest';

/**
 * Stub `globalThis.fetch` with a handler. `calls` records every invocation
 * with its URL and `RequestInit`. Auto-restores when the current test ends.
 *
 * Must be called from within a test (or a helper called from one) so vitest
 * has a test context to attach the cleanup to.
 */
export function installMockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): { calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === 'string' ? input : input.toString(),
      init,
    });
    return handler(input, init);
  }) as typeof fetch;
  onTestFinished(() => {
    globalThis.fetch = original;
  });
  return { calls };
}

/** Convenience for the JSON shape returned by the recording backend's init endpoint. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
