import { abortableSleep } from '@spotify-confidence/client-http';
import { withRequestLogic } from './factory';
import { setMaxListeners } from 'node:events';
const RESOLVE_ENDPOINT = 'https://resolver.confidence.dev/v1/flags:resolve';
const APPLY_ENDPOINT = 'https://resolver.confidence.dev/v1/flags:apply';

setMaxListeners(50);

describe('withRequestLogic', () => {
  const fetchMock = jest.fn<Promise<Response>, [Request]>();

  let underTest: typeof fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    underTest = withRequestLogic(fetchMock);
  });
  afterEach(() => {
    if (jest.getTimerCount() !== 0) throw new Error('test finished with remaining timers');
    jest.useRealTimers();
  });

  it('should throw on unknown urls', async () => {
    fetchMock.mockResolvedValue(new Response());

    await expect(underTest('https://resolver.confidence.dev/v1/flags:bad')).rejects.toThrow(
      'Unexpected url: https://resolver.confidence.dev/v1/flags:bad',
    );
  });

  describe('resolve', () => {
    function makeResolveRequest(timeout: number): Promise<Response> {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeout);
      return underTest(RESOLVE_ENDPOINT, { method: 'POST', body: '{}', signal: abortController.signal }).finally(() => {
        clearTimeout(timeoutId);
      });
    }

    it('should make retries until timeout', async () => {
      const attempts: number[] = [];

      fetchMock.mockImplementation(async ({ signal }) => {
        signal.throwIfAborted();
        attempts.push(Date.now());
        return new Response(null, { status: 500 });
      });

      expect(makeResolveRequest(3000)).rejects.toThrow('This operation was aborted');

      await jest.runAllTimersAsync();

      expect(Date.now()).toBe(3000);
      // the rate limiting allows three initial requests, then one per second
      expect(attempts).toEqual([0, 0, 0, 1000, 2000]);
    });

    it('should abort the previous request', async () => {
      fetchMock.mockImplementation(async ({ signal }) => {
        await abortableSleep(100, signal);
        return new Response();
      });

      expect(makeResolveRequest(1000)).rejects.toThrow('Request superseded');
      expect(makeResolveRequest(1000)).resolves.toMatchObject({ status: 200 });

      await jest.runAllTimersAsync();
    });
  });

  describe('apply', () => {
    function makeApplyRequest(): Promise<Response> {
      return underTest(APPLY_ENDPOINT, { method: 'POST', body: '{}' });
    }

    it('should make retries until timeout', async () => {
      let previousAttemptTime = Number.NEGATIVE_INFINITY;
      const delays: number[] = [];

      // make jitter predictable
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      fetchMock.mockImplementation(async ({ signal }) => {
        signal.throwIfAborted();
        const currentTime = Date.now();
        if (Number.isFinite(previousAttemptTime)) {
          delays.push((currentTime - previousAttemptTime) / 1000);
        }
        previousAttemptTime = currentTime;
        return new Response(null, { status: 500 });
      });

      const doneTime = expect(makeApplyRequest())
        .rejects.toThrow('Request timed out')
        .then(() => Date.now());
      await nextCall(fetchMock);
      await jest.runAllTimersAsync();

      // 30 min timeout
      expect(await doneTime).toBe(1000 * 60 * 30);
      // delay of 5s with exponential backoff and max delay of 5 min (300s)
      expect(delays).toEqual([5, 10, 20, 40, 80, 160, 300, 300, 300, 300]);
    });

    it('rejects more than a thousand pending requests', async () => {
      fetchMock.mockImplementation(async () => new Response());

      for (let i = 0; i < 1000; i++) {
        expect(makeApplyRequest()).resolves.toBeInstanceOf(Response);
      }
      expect(makeApplyRequest()).rejects.toThrow('Number of pending requests exceeded');
      expect(makeApplyRequest()).rejects.toThrow('Number of pending requests exceeded');
      await jest.runAllTimersAsync();
      // we can make two requests per second, except for the first two which happen directly, so in total 499s
      expect(Date.now() / 1000).toBe(499);
    });

    it('uses actual send time (irrespective of retry or rate limit)', async () => {
      fetchMock.mockImplementation(async request => {
        const { sendTime } = await request.json();
        expect(sendTime).toBe(new Date().toISOString());
        return new Response();
      });

      for (let i = 0; i < 10; i++) {
        makeApplyRequest();
      }
      await nextCall(fetchMock);
      await jest.runAllTimersAsync();
      expect.assertions(10);
    });
  });
});

function nextCall(mock: jest.Mock): Promise<void> {
  return new Promise(resolve => {
    const impl = mock.getMockImplementation();

    mock.mockImplementationOnce((...args) => {
      let maybePromise: any;
      try {
        return (maybePromise = impl?.(...args)!);
      } finally {
        Promise.resolve(maybePromise).finally(resolve);
      }
    });
  });
}
