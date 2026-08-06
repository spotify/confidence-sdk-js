/**
 * @jest-environment jsdom
 */
import { ErrorCode, ProviderEvents } from '@openfeature/web-sdk';
import { ConfidenceClient } from '@spotify-confidence/sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';

const SECRET = 'test-client-secret';

/** Canonical protobuf JSON, as the resolver emits it: defaults omitted. */
const RESOLVE_RESPONSE = {
  resolvedFlags: [
    {
      flag: 'flags/tutorial-feature',
      variant: 'flags/tutorial-feature/variants/treatment',
      value: { title: 'Hello', enabled: true, count: 3, nested: { deep: 'value' } },
      reason: 'RESOLVE_REASON_MATCH',
      shouldApply: true,
      assignmentOrigin: 'rule-1',
    },
    {
      flag: 'flags/no-match',
      reason: 'RESOLVE_REASON_NO_SEGMENT_MATCH',
      shouldApply: true,
    },
  ],
  resolveToken: 'AQIDBP8=',
  resolveId: 'resolve-123',
};

/** Built by hand rather than with `Response`, which jsdom does not provide. */
function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function mockFetch(resolveBody: unknown = RESOLVE_RESPONSE) {
  return jest.fn(async (url: any, init: any) => {
    void init;
    return jsonResponse(String(url).endsWith(':apply') ? {} : resolveBody);
  });
}

/** A fetch that only settles when the test says so, or when the signal aborts. */
function pendingFetch() {
  const calls: Array<{ url: string; signal: AbortSignal; settle: (body: unknown) => void }> = [];
  const fetchImpl = jest.fn(
    (url: any, init: any) =>
      new Promise<Response>((resolve, reject) => {
        calls.push({ url: String(url), signal: init.signal, settle: body => resolve(jsonResponse(body)) });
        init.signal?.addEventListener('abort', () => reject(init.signal.reason));
      }),
  );
  return Object.assign(fetchImpl, { calls });
}

function requestsTo(fetchImpl: jest.Mock, path: string): any[] {
  return fetchImpl.mock.calls.filter(([url]) => String(url).endsWith(path)).map(([, init]) => JSON.parse(init.body));
}
const resolveRequests = (fetchImpl: jest.Mock) => requestsTo(fetchImpl, '/v1/flags:resolve');
const applyRequests = (fetchImpl: jest.Mock) => requestsTo(fetchImpl, '/v1/flags:apply');

function createProvider(
  fetchImpl: jest.Mock | typeof fetch,
  { timeout = 1000, applyDebounce = 10 }: { timeout?: number; applyDebounce?: number } = {},
): ConfidenceWebProvider {
  const client = new ConfidenceClient({ clientSecret: SECRET, fetch: fetchImpl as unknown as typeof fetch });
  return new ConfidenceWebProvider(client, { timeout, applyDebounce });
}

describe('ConfidenceWebProvider', () => {
  describe('initialize', () => {
    it('resolves every flag with exposure deferred', async () => {
      const fetchImpl = mockFetch();
      await createProvider(fetchImpl).initialize({ targetingKey: 'user-1', country: 'SE' });

      expect(resolveRequests(fetchImpl)).toEqual([
        {
          // No `flags` means every flag available to the client, and a missing
          // `apply` is proto3 for false: exposure waits for evaluation.
          evaluationContext: { targeting_key: 'user-1', country: 'SE' },
          clientSecret: SECRET,
          sdk: expect.any(Object),
        },
      ]);
    });

    it('resolves without a context', async () => {
      const fetchImpl = mockFetch();
      await createProvider(fetchImpl).initialize();
      expect(resolveRequests(fetchImpl)[0].evaluationContext).toEqual({});
    });

    it('converts context the way targeting expects it', async () => {
      const fetchImpl = mockFetch();
      await createProvider(fetchImpl).initialize({
        targetingKey: 'user-1',
        visited: new Date('2024-01-01T00:00:00.000Z'),
        pants: { color: 'Yellow' },
        tags: ['a', 'b'],
        // A null attribute is dropped rather than sent as null
        removed: null,
      });

      expect(resolveRequests(fetchImpl)[0].evaluationContext).toEqual({
        targeting_key: 'user-1',
        visited: '2024-01-01T00:00:00.000Z',
        pants: { color: 'Yellow' },
        tags: ['a', 'b'],
      });
    });

    it('rejects when the resolve fails', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('network down');
      });
      await expect(createProvider(fetchImpl).initialize({})).rejects.toThrow(/Provider initialization failed/);
    });

    it('rejects on timeout', async () => {
      const fetchImpl = pendingFetch();
      await expect(createProvider(fetchImpl, { timeout: 0 }).initialize({})).rejects.toThrow(/Resolve timeout/);
      expect(fetchImpl.calls[0].signal.aborted).toBe(true);
    });
  });

  describe('evaluation', () => {
    let provider: ConfidenceWebProvider;

    beforeEach(async () => {
      provider = createProvider(mockFetch());
      await provider.initialize({ targetingKey: 'user-1' });
    });

    it('evaluates a flag value', () => {
      expect(provider.resolveObjectEvaluation('tutorial-feature', {})).toEqual({
        value: { title: 'Hello', enabled: true, count: 3, nested: { deep: 'value' } },
        reason: 'MATCH',
        variant: 'flags/tutorial-feature/variants/treatment',
      });
    });

    it('evaluates typed values through a dot path', () => {
      expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default')).toMatchObject({
        value: 'Hello',
        reason: 'MATCH',
      });
      expect(provider.resolveBooleanEvaluation('tutorial-feature.enabled', false)).toMatchObject({ value: true });
      expect(provider.resolveNumberEvaluation('tutorial-feature.count', 0)).toMatchObject({ value: 3 });
      expect(provider.resolveStringEvaluation('tutorial-feature.nested.deep', 'default')).toMatchObject({
        value: 'value',
      });
    });

    it('returns the default with the resolve reason when nothing matched', () => {
      expect(provider.resolveStringEvaluation('no-match.title', 'default')).toEqual({
        value: 'default',
        reason: 'NO_SEGMENT_MATCH',
      });
    });

    it('reports an unknown flag as FLAG_NOT_FOUND', () => {
      expect(provider.resolveStringEvaluation('not-a-flag', 'default')).toMatchObject({
        value: 'default',
        reason: 'ERROR',
        errorCode: ErrorCode.FLAG_NOT_FOUND,
      });
    });

    it('reports a mistyped default as TYPE_MISMATCH', () => {
      expect(provider.resolveNumberEvaluation('tutorial-feature.title', 42)).toMatchObject({
        value: 42,
        reason: 'ERROR',
        errorCode: ErrorCode.TYPE_MISMATCH,
      });
    });

    it('reports PROVIDER_NOT_READY before a resolve has landed', () => {
      expect(createProvider(mockFetch()).resolveStringEvaluation('tutorial-feature.title', 'default')).toEqual({
        value: 'default',
        reason: 'ERROR',
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        errorMessage: 'Provider not ready',
      });
    });

    it('reports the resolve failure, not a missing flag, when the resolve failed', async () => {
      const failing = createProvider(
        jest.fn(async () => {
          throw new Error('network down');
        }),
      );
      await expect(failing.initialize({})).rejects.toThrow();

      expect(failing.resolveStringEvaluation('tutorial-feature.title', 'default')).toMatchObject({
        value: 'default',
        reason: 'ERROR',
        errorCode: ErrorCode.GENERAL,
        errorMessage: expect.stringContaining('network down'),
      });
    });

    it('publishes assigned variants for Confidence developer tooling', () => {
      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      provider.resolveStringEvaluation('no-match.title', 'default');

      // A flag that matched nothing was never assigned a variant.
      expect(window.__confidence?.flags).toEqual({
        'flags/tutorial-feature': {
          variant: 'flags/tutorial-feature/variants/treatment',
          assignmentOrigin: 'rule-1',
        },
      });
    });
  });

  describe('exposure', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('applies every flag evaluated within the debounce window in one request', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.initialize({});

      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      provider.resolveStringEvaluation('no-match.title', 'default');
      // Nothing has been applied yet: the window is still open.
      expect(applyRequests(fetchImpl)).toHaveLength(0);

      jest.advanceTimersByTime(10);

      expect(applyRequests(fetchImpl)).toEqual([
        {
          flags: [
            { flag: 'flags/tutorial-feature', applyTime: expect.any(String) },
            { flag: 'flags/no-match', applyTime: expect.any(String) },
          ],
          clientSecret: SECRET,
          resolveToken: 'AQIDBP8=',
          sendTime: expect.any(String),
          sdk: expect.any(Object),
        },
      ]);
    });

    it('applies a flag once, however often it is evaluated', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.initialize({});

      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      jest.advanceTimersByTime(10);
      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      provider.resolveBooleanEvaluation('tutorial-feature.enabled', false);
      jest.advanceTimersByTime(10);

      expect(applyRequests(fetchImpl)).toHaveLength(1);
    });

    it('applies immediately with a zero debounce', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl, { applyDebounce: 0 });
      await provider.initialize({});

      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      expect(applyRequests(fetchImpl)).toHaveLength(1);
    });

    it('does not apply a flag that says it should not be applied', async () => {
      const fetchImpl = mockFetch({
        ...RESOLVE_RESPONSE,
        resolvedFlags: [{ ...RESOLVE_RESPONSE.resolvedFlags[0], shouldApply: false }],
      });
      const provider = createProvider(fetchImpl);
      await provider.initialize({});

      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      jest.advanceTimersByTime(10);

      expect(applyRequests(fetchImpl)).toHaveLength(0);
    });

    it('records collected exposure on close, before the token is dropped', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.initialize({});

      provider.resolveStringEvaluation('tutorial-feature.title', 'default');
      await provider.onClose();

      expect(applyRequests(fetchImpl)).toHaveLength(1);
    });
  });

  describe('onContextChange', () => {
    it('does not re-resolve when nothing changed', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.onContextChange({ targetingKey: 'user-1' }, { targetingKey: 'user-1' });
      expect(resolveRequests(fetchImpl)).toHaveLength(0);
    });

    it('re-resolves and emits stale, then ready and configuration changed', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.initialize({ targetingKey: 'user-1' });

      const events: string[] = [];
      provider.events.addHandler(ProviderEvents.Stale, () => events.push('stale'));
      provider.events.addHandler(ProviderEvents.Ready, () => events.push('ready'));
      provider.events.addHandler(ProviderEvents.ConfigurationChanged, () => events.push('changed'));

      await provider.onContextChange({ targetingKey: 'user-1' }, { targetingKey: 'user-2' });

      expect(events).toEqual(['stale', 'ready', 'changed']);
      expect(resolveRequests(fetchImpl)[1].evaluationContext).toEqual({ targeting_key: 'user-2' });
    });

    it('rejects when the resolve fails, and reports the failure from evaluations', async () => {
      const fetchImpl = jest
        .fn()
        .mockResolvedValueOnce(jsonResponse(RESOLVE_RESPONSE))
        .mockRejectedValueOnce(new Error('network down'));
      const provider = createProvider(fetchImpl);
      await provider.initialize({ targetingKey: 'user-1' });

      await expect(provider.onContextChange({ targetingKey: 'user-1' }, { targetingKey: 'user-2' })).rejects.toThrow(
        /Provider context change failed/,
      );
      // The stale values are gone: they belonged to a context that no longer applies.
      expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default')).toMatchObject({
        value: 'default',
        errorCode: ErrorCode.GENERAL,
      });
    });

    it('lets the newest resolve win, whatever order they come back in', async () => {
      const fetchImpl = pendingFetch();
      const provider = createProvider(fetchImpl);

      const events: string[] = [];
      provider.events.addHandler(ProviderEvents.Stale, () => events.push('stale'));
      provider.events.addHandler(ProviderEvents.Ready, () => events.push('ready'));
      provider.events.addHandler(ProviderEvents.ConfigurationChanged, () => events.push('changed'));

      const first = provider.onContextChange({}, { targetingKey: 'user-1' });
      const second = provider.onContextChange({ targetingKey: 'user-1' }, { targetingKey: 'user-2' });

      // Starting the second resolve abandons the first.
      expect(fetchImpl.calls[0].signal.aborted).toBe(true);
      fetchImpl.calls[1].settle({
        ...RESOLVE_RESPONSE,
        resolvedFlags: [{ ...RESOLVE_RESPONSE.resolvedFlags[0], value: { title: 'For user-2' }, shouldApply: false }],
      });
      await Promise.all([first, second]);

      expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default')).toMatchObject({
        value: 'For user-2',
      });
      // The abandoned change announces nothing: only the resolve that owns the
      // state reports it ready.
      expect(events).toEqual(['stale', 'stale', 'ready', 'changed']);
    });
  });

  describe('track', () => {
    const EVENTS_URL = 'https://events.confidence.dev/v1/events:publish';

    /** Every request the provider made to the events service. */
    function eventRequests(fetchImpl: jest.Mock): any[] {
      return fetchImpl.mock.calls
        .filter(([url]) => String(url) === EVENTS_URL)
        .map(([, init]) => JSON.parse(init.body));
    }

    it('sends the event with the context OpenFeature passed in', async () => {
      const fetchImpl = mockFetch();
      const provider = createProvider(fetchImpl);
      await provider.initialize({ targetingKey: 'user-1' });

      // OpenFeature hands the provider the effective context on every call, so
      // the event is attributed to that rather than to the last resolve.
      provider.track('order-completed', { targetingKey: 'user-2', country: 'SE' }, { value: 42 });

      expect(eventRequests(fetchImpl)).toEqual([
        {
          clientSecret: SECRET,
          sendTime: expect.any(String),
          events: [
            {
              eventDefinition: 'eventDefinitions/order-completed',
              eventTime: expect.any(String),
              payload: { context: { targeting_key: 'user-2', country: 'SE' }, value: 42 },
            },
          ],
        },
      ]);
    });

    it('returns synchronously, as the OpenFeature signature requires', () => {
      const fetchImpl = mockFetch();
      expect(createProvider(fetchImpl).track('order-completed', {})).toBeUndefined();
    });

    it('tracks without a resolve having happened', () => {
      // Tracking does not read flag state, so it does not need a ready provider.
      const fetchImpl = mockFetch();
      createProvider(fetchImpl).track('page-viewed', { targetingKey: 'user-1' });
      expect(eventRequests(fetchImpl)).toHaveLength(1);
    });

    it('sends the event with keepalive so it survives a page unload', () => {
      const fetchImpl = mockFetch();
      createProvider(fetchImpl).track('order-completed', {});
      const [, init] = fetchImpl.mock.calls.find(([url]) => String(url) === EVENTS_URL)!;
      expect(init.keepalive).toBe(true);
    });

    it('does not let tracking details displace the attribution context', () => {
      // TrackingEventDetails is an open record, so `context` is a legal key in
      // it — but the context OpenFeature passed is the authoritative one.
      const fetchImpl = mockFetch();
      createProvider(fetchImpl).track('order-completed', { targetingKey: 'user-1' }, {
        context: 'not-a-context',
      } as any);

      expect(eventRequests(fetchImpl)[0].events[0].payload).toEqual({ context: { targeting_key: 'user-1' } });
    });

    it('does not throw when the event fails to send', async () => {
      const fetchImpl = jest.fn(async () => {
        throw new Error('network down');
      });
      expect(() => createProvider(fetchImpl).track('order-completed', {})).not.toThrow();
      // Let the fire-and-forget promise settle so a rejection would surface.
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  });
});
