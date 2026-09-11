import { ErrorCode, OpenFeature, ProviderStatus } from '@openfeature/server-sdk';
import { ConfidenceClient } from '@spotify-confidence/sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

const SECRET = 'test-client-secret';

/** Canonical protobuf JSON, as the resolver emits it: defaults omitted. */
const RESOLVE_RESPONSE = {
  resolvedFlags: [
    {
      flag: 'flags/tutorial-feature',
      variant: 'flags/tutorial-feature/variants/treatment',
      value: { title: 'Hello', enabled: true, count: 3 },
      reason: 'RESOLVE_REASON_MATCH',
      shouldApply: true,
      assignmentOrigin: 'rule-1',
    },
  ],
  resolveId: 'resolve-123',
};

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
    void url;
    void init;
    return jsonResponse(resolveBody);
  });
}

function resolveRequests(fetchImpl: jest.Mock): any[] {
  return fetchImpl.mock.calls.map(([, init]) => JSON.parse(init.body));
}

function createProvider(fetchImpl: jest.Mock | typeof fetch, timeout = 1000): ConfidenceServerProvider {
  const client = new ConfidenceClient({ clientSecret: SECRET, fetch: fetchImpl as unknown as typeof fetch });
  return new ConfidenceServerProvider(client, { timeout });
}

describe('ConfidenceServerProvider', () => {
  it('evaluates and tracks with merged context through OpenFeature, then drains on close', async () => {
    const fetchImpl = mockFetch();
    const provider = createProvider(fetchImpl);
    await OpenFeature.setProviderAndWait(provider);
    OpenFeature.setContext({ country: 'SE' });
    try {
      const client = OpenFeature.getClient();
      expect(await client.getStringValue('tutorial-feature.title', 'default', { targetingKey: 'user-1' })).toBe(
        'Hello',
      );
      client.track('checkout', { targetingKey: 'user-1' }, { value: 42 });
      await provider.onClose();
      expect(resolveRequests(fetchImpl)[0].evaluationContext).toEqual({ country: 'SE', targeting_key: 'user-1' });
      expect(resolveRequests(fetchImpl)[1].events[0].payload).toEqual({
        value: 42,
        context: { country: 'SE', targeting_key: 'user-1' },
      });
    } finally {
      await OpenFeature.clearProviders();
      OpenFeature.setContext({});
    }
  });

  it('bounds pending tracking requests and waits for them on close', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(
        (_url: any, init: any) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason));
          }),
      );
      const provider = createProvider(fetchImpl, 100);
      provider.track('checkout', {});
      let closed = false;
      const closing = provider.onClose().then(() => {
        closed = true;
      });
      await jest.advanceTimersByTimeAsync(99);
      expect(closed).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await closing;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('is ready without initializing: each evaluation stands on its own', () => {
    expect(createProvider(mockFetch()).status).toEqual(ProviderStatus.READY);
  });

  it('resolves only the flag being evaluated, and applies it', async () => {
    const fetchImpl = mockFetch();
    await createProvider(fetchImpl).resolveStringEvaluation('tutorial-feature.title', 'default', {
      targetingKey: 'user-1',
      country: 'SE',
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe('https://resolver.confidence.dev/v1/flags:resolve');
    expect(init.signal).toBeDefined();
    expect(resolveRequests(fetchImpl)).toEqual([
      {
        flags: ['flags/tutorial-feature'],
        evaluationContext: { targeting_key: 'user-1', country: 'SE' },
        clientSecret: SECRET,
        // On a server the resolve *is* the access, so exposure is recorded by it
        // and there is no second apply request.
        apply: true,
        sdk: expect.any(Object),
      },
    ]);
  });

  it('resolves once per evaluation, against the context it was given', async () => {
    const fetchImpl = mockFetch();
    const provider = createProvider(fetchImpl);

    await provider.resolveBooleanEvaluation('tutorial-feature.enabled', false, { targetingKey: 'user-1' });
    await provider.resolveNumberEvaluation('tutorial-feature.count', 0, { targetingKey: 'user-2' });

    expect(resolveRequests(fetchImpl).map(({ evaluationContext }) => evaluationContext)).toEqual([
      { targeting_key: 'user-1' },
      { targeting_key: 'user-2' },
    ]);
  });

  it('evaluates typed values and whole structs', async () => {
    const provider = createProvider(mockFetch());

    await expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default', {})).resolves.toEqual({
      value: 'Hello',
      reason: 'MATCH',
      variant: 'flags/tutorial-feature/variants/treatment',
    });
    await expect(provider.resolveBooleanEvaluation('tutorial-feature.enabled', false, {})).resolves.toMatchObject({
      value: true,
    });
    await expect(provider.resolveNumberEvaluation('tutorial-feature.count', 0, {})).resolves.toMatchObject({
      value: 3,
    });
    await expect(provider.resolveObjectEvaluation('tutorial-feature', {}, {})).resolves.toMatchObject({
      value: { title: 'Hello', enabled: true, count: 3 },
    });
  });

  it('converts context the way targeting expects it', async () => {
    const fetchImpl = mockFetch();
    await createProvider(fetchImpl).resolveStringEvaluation('tutorial-feature.title', 'default', {
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

  it('reports an unknown flag as FLAG_NOT_FOUND', async () => {
    const provider = createProvider(mockFetch({ ...RESOLVE_RESPONSE, resolvedFlags: [] }));

    await expect(provider.resolveStringEvaluation('not-a-flag', 'default', {})).resolves.toMatchObject({
      value: 'default',
      reason: 'ERROR',
      errorCode: ErrorCode.FLAG_NOT_FOUND,
    });
  });

  it('reports a mistyped default as TYPE_MISMATCH', async () => {
    const provider = createProvider(mockFetch());

    await expect(provider.resolveNumberEvaluation('tutorial-feature.title', 42, {})).resolves.toMatchObject({
      value: 42,
      reason: 'ERROR',
      errorCode: ErrorCode.TYPE_MISMATCH,
    });
  });

  it('returns the default with the resolve reason when nothing matched', async () => {
    const provider = createProvider(
      mockFetch({
        resolvedFlags: [{ flag: 'flags/tutorial-feature', reason: 'RESOLVE_REASON_NO_SEGMENT_MATCH' }],
        resolveId: 'resolve-123',
      }),
    );

    await expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default', {})).resolves.toEqual({
      value: 'default',
      reason: 'NO_SEGMENT_MATCH',
    });
  });

  it('returns defaults rather than throwing when the resolve fails', async () => {
    const provider = createProvider(
      jest.fn(async () => {
        throw new Error('network down');
      }),
    );

    await expect(provider.resolveStringEvaluation('tutorial-feature.title', 'default', {})).resolves.toMatchObject({
      value: 'default',
      reason: 'ERROR',
      errorCode: ErrorCode.GENERAL,
      errorMessage: expect.stringContaining('network down'),
    });
  });

  it('gives up on a resolve that outlives the timeout', async () => {
    const fetchImpl = jest.fn(
      (_url: any, init: any) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason));
        }),
    );

    await expect(
      createProvider(fetchImpl, 1).resolveStringEvaluation('tutorial-feature.title', 'default', {}),
    ).resolves.toMatchObject({
      value: 'default',
      reason: 'ERROR',
      errorCode: ErrorCode.GENERAL,
      errorMessage: expect.stringContaining('TimeoutError'),
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

    it('sends the event with the context it was given', () => {
      const fetchImpl = mockFetch({});
      createProvider(fetchImpl).track('order-completed', { targetingKey: 'user-1', country: 'SE' }, { value: 42 });

      expect(eventRequests(fetchImpl)).toEqual([
        {
          clientSecret: SECRET,
          sendTime: expect.any(String),
          events: [
            {
              eventDefinition: 'eventDefinitions/order-completed',
              eventTime: expect.any(String),
              // targetingKey converted to the resolver's targeting_key spelling
              payload: { context: { targeting_key: 'user-1', country: 'SE' }, value: 42 },
            },
          ],
        },
      ]);
    });

    it('returns synchronously, as the OpenFeature signature requires', () => {
      const fetchImpl = mockFetch({});
      // Not a promise: nothing for a caller to await or forget to await.
      expect(createProvider(fetchImpl).track('order-completed', {})).toBeUndefined();
    });

    it('works with no context and no details', () => {
      const fetchImpl = mockFetch({});
      createProvider(fetchImpl).track('page-viewed');
      expect(eventRequests(fetchImpl)[0].events[0].payload).toEqual({ context: {} });
    });

    it('does not let tracking details displace the attribution context', () => {
      // TrackingEventDetails is an open record, so `context` is a legal key in
      // it — but the context OpenFeature passed is the authoritative one.
      const fetchImpl = mockFetch({});
      createProvider(fetchImpl).track('order-completed', { targetingKey: 'user-1' }, {
        context: 'not-a-context',
      } as any);

      expect(eventRequests(fetchImpl)[0].events[0].payload).toEqual({ context: { targeting_key: 'user-1' } });
    });

    it('does not throw when the event fails to send', async () => {
      // The signature is void, so a failure has nowhere to go but the log.
      const fetchImpl = jest.fn(async () => {
        throw new Error('network down');
      });
      expect(() => createProvider(fetchImpl).track('order-completed', {})).not.toThrow();
      // Let the fire-and-forget promise settle so a rejection would surface.
      await new Promise(resolve => setImmediate(resolve));
    });
  });
});
