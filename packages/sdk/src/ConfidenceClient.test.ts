import { ConfidenceClient } from './ConfidenceClient';
import { FlagBundle } from './FlagBundle';

const SECRET = 'test-client-secret';

/**
 * A canonical protobuf JSON `ResolveFlagsResponse` — the shape pbjson emits
 * (lowerCamelCase fields, enums as proto-name strings, bytes as base64).
 * Default-valued fields are omitted, as canonical JSON requires.
 */
const RESOLVE_RESPONSE = {
  resolvedFlags: [
    {
      flag: 'flags/promo-banner',
      variant: 'flags/promo-banner/variants/treatment',
      value: { show: true, text: 'Hello', nested: { count: 3 } },
      reason: 'RESOLVE_REASON_MATCH',
      shouldApply: true,
      assignmentOrigin: 'rule-1',
    },
    {
      flag: 'flags/checkout-redesign',
      reason: 'RESOLVE_REASON_NO_SEGMENT_MATCH',
      // shouldApply omitted — canonical JSON omits `false`
    },
  ],
  resolveToken: 'AQIDBP8=', // bytes [1, 2, 3, 4, 255]
  resolveId: 'resolve-123',
};

function mockTransport(
  responseBody: unknown = RESOLVE_RESPONSE,
  { status = 200, statusText = 'OK', body }: { status?: number; statusText?: string; body?: string } = {},
) {
  const fetchImpl = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    void url;
    void init;
    return new Response(body ?? JSON.stringify(responseBody), {
      status,
      statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return fetchImpl as unknown as typeof fetch & { mock: (typeof fetchImpl)['mock'] };
}

function requestBody(fetchImpl: { mock: { calls: any[][] } }, call = 0): any {
  return JSON.parse(fetchImpl.mock.calls[call][1].body);
}

function client(fetchImpl: typeof fetch, url?: string) {
  return new ConfidenceClient({ flagClientSecret: SECRET, url, fetch: fetchImpl });
}

function bytesFromBase64(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

/** What `fetch` rejects with when an `AbortSignal.timeout()` fires. */
function timeoutError(): Error {
  return new DOMException('The operation was aborted due to timeout', 'TimeoutError');
}

describe('ConfidenceClient', () => {
  describe('resolve', () => {
    it('posts canonical protobuf JSON to /v1/flags:resolve', async () => {
      const fetchImpl = mockTransport();
      await client(fetchImpl).resolve(['promo-banner', 'checkout-redesign'], {
        targeting_key: 'user-1',
        country: 'SE',
      });

      const [url, init] = (fetchImpl as any).mock.calls[0];
      expect(url).toBe('https://resolver.confidence.dev/v1/flags:resolve');
      expect(init.method).toBe('POST');
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

      expect(requestBody(fetchImpl as any)).toEqual({
        flags: ['flags/promo-banner', 'flags/checkout-redesign'],
        // Context is passed through verbatim — `targeting_key`, not `targetingKey`
        evaluationContext: { targeting_key: 'user-1', country: 'SE' },
        clientSecret: SECRET,
        apply: true,
        sdk: { id: 'SDK_ID_JS_CONFIDENCE', version: expect.any(String) },
      });
    });

    it('applies by default so naive usage never loses exposure data', async () => {
      const fetchImpl = mockTransport();
      await client(fetchImpl).resolve(['promo-banner'], {});
      expect(requestBody(fetchImpl as any).apply).toBe(true);
    });

    it('omits `apply` when false, which proto3 decodes back to false', async () => {
      const fetchImpl = mockTransport();
      await client(fetchImpl).resolve(['promo-banner'], {}, { apply: false });
      // Canonical protobuf JSON omits default-valued fields. A missing bool
      // decodes to false, so a deferred-apply resolve stays deferred.
      expect(requestBody(fetchImpl as any)).not.toHaveProperty('apply');
    });

    it('sends no `flags` for an empty array, meaning "all flags"', async () => {
      const fetchImpl = mockTransport();
      await client(fetchImpl).resolve([], { targeting_key: 'user-1' });
      expect(requestBody(fetchImpl as any)).not.toHaveProperty('flags');
    });

    it('converts the response into a FlagBundle keyed by unprefixed flag name', async () => {
      const bundle = await client(mockTransport()).resolve(['promo-banner'], {});

      expect(Object.keys(bundle.flags)).toEqual(['promo-banner', 'checkout-redesign']);
      expect(bundle.resolveId).toBe('resolve-123');
      expect(bundle.flags['promo-banner']).toEqual({
        reason: 'MATCH',
        variant: 'flags/promo-banner/variants/treatment',
        value: { show: true, text: 'Hello', nested: { count: 3 } },
        shouldApply: true,
        assignmentOrigin: 'rule-1',
      });
      expect(bundle.flags['checkout-redesign']).toMatchObject({
        reason: 'NO_SEGMENT_MATCH',
        value: null,
        shouldApply: false,
      });
    });

    it('exposes resolveToken as a base64 string so the bundle is JSON-forwardable', async () => {
      const bundle = await client(mockTransport()).resolve(['promo-banner'], {});
      expect(bundle.resolveToken).toBe('AQIDBP8=');
      expect(JSON.parse(JSON.stringify(bundle)).resolveToken).toBe('AQIDBP8=');
    });

    it('returns an errored bundle on HTTP errors, surfacing the resolver diagnostic', async () => {
      const fetchImpl = mockTransport(undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        body: 'client secret not found: requested=te***et, available=[ab***cd]',
      });
      const bundle = await client(fetchImpl).resolve(['promo-banner'], {});

      expect(bundle.errorCode).toBe('GENERAL');
      expect(bundle.errorMessage).toMatch(/500 Internal Server Error - client secret not found/);
      expect(bundle.flags).toEqual({});
    });

    it('returns an errored bundle on transport errors', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as unknown as typeof fetch;
      const bundle = await client(fetchImpl).resolve(['promo-banner'], {});

      expect(bundle.errorCode).toBe('GENERAL');
      expect(bundle.errorMessage).toMatch('connect ECONNREFUSED');
    });

    it('returns an errored bundle on a malformed response body', async () => {
      const fetchImpl = jest.fn(async () => new Response('not json', { status: 200 })) as unknown as typeof fetch;
      const bundle = await client(fetchImpl).resolve(['promo-banner'], {});

      expect(bundle.errorCode).toBe('GENERAL');
    });

    it('errored bundles evaluate to the default with an ERROR reason', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as unknown as typeof fetch;
      // The bundle is still plain JSON, so the failure reaches a browser
      // labelled as an error rather than as a missing flag.
      const forwarded = JSON.parse(JSON.stringify(await client(fetchImpl).resolve(['promo-banner'], {})));

      expect(FlagBundle.evaluate(forwarded, 'promo-banner.text', 'fallback')).toMatchObject({
        reason: 'ERROR',
        errorCode: 'GENERAL',
        value: 'fallback',
        shouldApply: false,
      });
    });

    it('forwards the abort signal to the transport', async () => {
      const fetchImpl = mockTransport();
      const signal = AbortSignal.timeout(5_000);
      await client(fetchImpl).resolve(['promo-banner'], {}, { signal });
      expect((fetchImpl as any).mock.calls[0][1].signal).toBe(signal);
    });

    it('labels a timed-out resolve TIMEOUT rather than GENERAL', async () => {
      // There is no timeout option — `AbortSignal.timeout()` is the whole
      // mechanism — so the errored bundle has to distinguish a slow resolver
      // from a misconfigured one.
      const fetchImpl = jest.fn(async () => {
        throw timeoutError();
      }) as unknown as typeof fetch;
      const bundle = await client(fetchImpl).resolve(['promo-banner'], {});

      expect(bundle.errorCode).toBe('TIMEOUT');
      expect(FlagBundle.evaluate(bundle, 'promo-banner.text', 'fallback')).toMatchObject({
        reason: 'ERROR',
        errorCode: 'TIMEOUT',
        value: 'fallback',
      });
    });

    it('labels a timeout nested under `cause` TIMEOUT too', async () => {
      // Some runtimes wrap the abort reason rather than surfacing it directly.
      const fetchImpl = jest.fn(async () => {
        throw Object.assign(new Error('fetch failed'), { cause: timeoutError() });
      }) as unknown as typeof fetch;
      expect((await client(fetchImpl).resolve(['promo-banner'], {})).errorCode).toBe('TIMEOUT');
    });

    it('labels a deliberate abort GENERAL, not TIMEOUT', async () => {
      // The caller who aborted already knows they did; only a deadline is a timeout.
      const fetchImpl = jest.fn(async () => {
        throw new DOMException('This operation was aborted', 'AbortError');
      }) as unknown as typeof fetch;
      expect((await client(fetchImpl).resolve(['promo-banner'], {})).errorCode).toBe('GENERAL');
    });

    it('normalizes trailing slashes on the base url', async () => {
      const fetchImpl = mockTransport();
      await client(fetchImpl, 'https://my-resolver.example.com//').resolve(['promo-banner'], {});
      expect((fetchImpl as any).mock.calls[0][0]).toBe('https://my-resolver.example.com/v1/flags:resolve');
    });
  });

  describe('apply', () => {
    it('posts canonical protobuf JSON to /v1/flags:apply', async () => {
      const fetchImpl = mockTransport({});
      await client(fetchImpl).apply('AQIDBP8=', ['promo-banner', 'checkout-redesign']);

      const [url] = (fetchImpl as any).mock.calls[0];
      expect(url).toBe('https://resolver.confidence.dev/v1/flags:apply');

      const body = requestBody(fetchImpl as any);
      expect(body.flags.map((f: any) => f.flag)).toEqual(['flags/promo-banner', 'flags/checkout-redesign']);
      expect(body.clientSecret).toBe(SECRET);
      expect(body.resolveToken).toBe('AQIDBP8=');
      expect(bytesFromBase64(body.resolveToken)).toEqual(new Uint8Array([1, 2, 3, 4, 255]));
      // Timestamps must be RFC3339 for pbjson to accept them
      expect(body.sendTime).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      expect(Number.isNaN(Date.parse(body.flags[0].applyTime))).toBe(false);
    });

    it('accepts a single flag name', async () => {
      const fetchImpl = mockTransport({});
      await client(fetchImpl).apply('AQIDBP8=', 'promo-banner');
      expect(requestBody(fetchImpl as any).flags).toEqual([
        { flag: 'flags/promo-banner', applyTime: expect.any(String) },
      ]);
    });

    it('does not call the network without a resolve token', async () => {
      // A resolve with apply=true returns an empty token; there is nothing to apply.
      const fetchImpl = mockTransport({});
      await expect(client(fetchImpl).apply('', 'promo-banner')).resolves.toEqual({ ok: true });
      expect((fetchImpl as any).mock.calls).toHaveLength(0);
    });

    it('does not call the network for an empty flag list', async () => {
      const fetchImpl = mockTransport({});
      await expect(client(fetchImpl).apply('AQIDBP8=', [])).resolves.toEqual({ ok: true });
      expect((fetchImpl as any).mock.calls).toHaveLength(0);
    });

    it('tolerates an empty response body', async () => {
      const fetchImpl = mockTransport(undefined, { body: '' });
      await expect(client(fetchImpl).apply('AQIDBP8=', 'promo-banner')).resolves.toEqual({ ok: true });
    });

    it('reports HTTP errors as a result, carrying the status so callers can retry 5xx only', async () => {
      const fetchImpl = mockTransport(undefined, { status: 403, statusText: 'Forbidden' });
      await expect(client(fetchImpl).apply('AQIDBP8=', 'promo-banner')).resolves.toEqual({
        ok: false,
        errorCode: 'GENERAL',
        errorMessage: expect.stringMatching(/403 Forbidden/),
        status: 403,
      });
    });

    it('reports transport errors as a result, with no status', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as unknown as typeof fetch;
      await expect(client(fetchImpl).apply('AQIDBP8=', 'promo-banner')).resolves.toEqual({
        ok: false,
        errorCode: 'GENERAL',
        errorMessage: expect.stringMatching('connect ECONNREFUSED'),
        status: undefined,
      });
    });

    it('never rejects, so an un-awaited apply cannot become an unhandled rejection', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as unknown as typeof fetch;
      // Node terminates the process on an unhandled rejection, and the natural
      // call site for exposure telemetry is fire-and-forget.
      const promise = client(fetchImpl).apply('AQIDBP8=', 'promo-banner');
      await expect(promise).resolves.toMatchObject({ ok: false });
    });

    it('reports a malformed resolve token as a result rather than throwing', async () => {
      const fetchImpl = mockTransport({});
      // Buffer.from is lenient, so force the browser path where atob throws.
      const buffer = (globalThis as any).Buffer;
      delete (globalThis as any).Buffer;
      try {
        await expect(client(fetchImpl).apply('not!valid!base64', 'promo-banner')).resolves.toMatchObject({
          ok: false,
          errorCode: 'GENERAL',
        });
      } finally {
        (globalThis as any).Buffer = buffer;
      }
    });

    it('forwards the abort signal to the transport', async () => {
      const fetchImpl = mockTransport({});
      const signal = AbortSignal.timeout(5_000);
      await client(fetchImpl).apply('AQIDBP8=', 'promo-banner', { signal });
      expect((fetchImpl as any).mock.calls[0][1].signal).toBe(signal);
    });

    it('reports a timed-out apply as TIMEOUT', async () => {
      const fetchImpl = jest.fn(async () => {
        throw timeoutError();
      }) as unknown as typeof fetch;
      await expect(client(fetchImpl).apply('AQIDBP8=', 'promo-banner')).resolves.toMatchObject({
        ok: false,
        errorCode: 'TIMEOUT',
      });
    });
  });

  describe('FlagBundle.evaluate', () => {
    const bundle = async () => client(mockTransport()).resolve(['promo-banner'], {});

    it('evaluates a whole flag against an object default', async () => {
      const details = FlagBundle.evaluate(await bundle(), 'promo-banner', { show: false, text: '' });
      expect(details.value).toEqual({ show: true, text: 'Hello', nested: { count: 3 } });
      expect(details.reason).toBe('MATCH');
      expect(details.shouldApply).toBe(true);
    });

    it('evaluates a dot path into the flag value', async () => {
      expect(FlagBundle.evaluate(await bundle(), 'promo-banner.text', 'default').value).toBe('Hello');
      expect(FlagBundle.evaluate(await bundle(), 'promo-banner.nested.count', 0).value).toBe(3);
    });

    it('returns the default with an ERROR reason on type mismatch', async () => {
      const details = FlagBundle.evaluate(await bundle(), 'promo-banner.text', 42);
      expect(details.value).toBe(42);
      expect(details.reason).toBe('ERROR');
      expect(details.errorCode).toBe('TYPE_MISMATCH');
    });

    it('returns the default with FLAG_NOT_FOUND for an unknown flag', async () => {
      const details = FlagBundle.evaluate(await bundle(), 'no-such-flag', false);
      expect(details.value).toBe(false);
      expect(details.reason).toBe('ERROR');
      expect(details.errorCode).toBe('FLAG_NOT_FOUND');
    });

    it('never throws, even on a garbage bundle', async () => {
      const empty: FlagBundle = { flags: {}, resolveId: '', resolveToken: '' };
      expect(() => FlagBundle.evaluate(empty, 'x.y.z', 'fallback')).not.toThrow();
      expect(FlagBundle.evaluate(empty, 'x.y.z', 'fallback').value).toBe('fallback');
    });

    it('substitutes the default for a flag that resolved to no value', async () => {
      const details = FlagBundle.evaluate(await bundle(), 'checkout-redesign', { enabled: false });
      expect(details.value).toEqual({ enabled: false });
      expect(details.reason).toBe('NO_SEGMENT_MATCH');
    });

    it('logs evaluation failures when a logger is passed', async () => {
      const warn = jest.fn();
      FlagBundle.evaluate(await bundle(), 'no-such-flag', 'fallback', { warn });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('flag not found'));
    });
  });

  describe('statelessness', () => {
    it('does no work on construction', () => {
      const fetchImpl = mockTransport();
      expect(new ConfidenceClient({ flagClientSecret: SECRET, fetch: fetchImpl })).toBeDefined();
      expect((fetchImpl as any).mock.calls).toHaveLength(0);
    });

    it('has no lifecycle methods to forget to call', () => {
      const instance = client(mockTransport()) as unknown as Record<string, unknown>;
      expect(instance.initialize).toBeUndefined();
      expect(instance.close).toBeUndefined();
    });
  });
});
