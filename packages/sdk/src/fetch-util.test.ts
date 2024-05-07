import { FetchBuilder } from './fetch-util';

jest.useFakeTimers();

describe('FetchBuilder', () => {
  describe('abortPrevious', () => {
    const response = new Response(null, { status: 200 });
    const simpleFetchMock = jest.fn<Promise<Response>, [Request]>(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          signal.onabort = () => reject(signal.reason);
          setTimeout(() => resolve(response), 100);
        }),
    );
    it('should pass one request through', async () => {
      const underTest = new FetchBuilder().abortPrevious().build(simpleFetchMock);

      const result = underTest('http://www.spotify.com');
      jest.runAllTimers();

      expect(await result).toBe(response);
    });

    it('should abort first request when a second arrives', async () => {
      const underTest = new FetchBuilder().abortPrevious().build(simpleFetchMock);

      // we need to turn the catch into a result or node will complain about unh
      expect(underTest('http://www.spotify.com')).rejects.toThrow('Request superseded');
      expect(underTest('http://www.spotify.com')).resolves.toBe(response);

      await jest.runAllTimersAsync();

      expect.assertions(2);
    });
  });
  describe('rateLimit', () => {
    it('it keeps request rate under maxRate', async () => {
      let requestCount = 0;
      const simpleFetchMock = async () => {
        requestCount++;
        return new Response();
      };

      const rateLimitedFetch = new FetchBuilder().rateLimit(10).build(simpleFetchMock);

      for (let i = 0; i < 30; i++) {
        rateLimitedFetch('http://spotify.com');
      }
      await jest.advanceTimersByTimeAsync(0);

      // the initial tokens are let through directly
      expect(requestCount).toBe(10);
      let prevCount = requestCount;
      while (jest.getTimerCount() > 0) {
        await jest.advanceTimersByTimeAsync(1000);
        expect(requestCount - prevCount <= 10).toBe(true);
        prevCount = requestCount;
      }

      expect(requestCount).toBe(30);
    });

    it(`manages request rate`, async () => {
      const startTime = Date.now();
      const requestTimes: Record<string, number> = {};
      const simpleFetchMock = async ({ url }: Request) => {
        requestTimes[url] = Date.now() - startTime;
        return new Response();
      };

      const rateLimitedFetch = new FetchBuilder()
        .rateLimit(10, { maxTokens: 2, initialTokens: 2 })
        .build(simpleFetchMock);

      rateLimitedFetch('http://spotify.com/1');
      rateLimitedFetch('http://spotify.com/2');
      rateLimitedFetch('http://spotify.com/3');
      rateLimitedFetch('http://spotify.com/4');

      await jest.runAllTimersAsync();

      expect(requestTimes).toEqual({
        'http://spotify.com/1': 0,
        'http://spotify.com/2': 0,
        'http://spotify.com/3': 100,
        'http://spotify.com/4': 200,
      });
    });

    it(`doesn't wait on aborted requests`, async () => {
      const startTime = Date.now();
      const requestTimes: Record<string, number> = {};
      const simpleFetchMock = async ({ url, signal }: Request) => {
        signal.throwIfAborted();
        requestTimes[url] = Date.now() - startTime;
        return new Response();
      };

      const rateLimitedFetch = new FetchBuilder().rateLimit(10, { initialTokens: 0 }).build(simpleFetchMock);

      const successHandler = jest.fn();
      const abortHandler = jest.fn();

      rateLimitedFetch('http://spotify.com/1').then(successHandler);
      rateLimitedFetch('http://spotify.com/2', { signal: timeoutSignal(50) }).catch(abortHandler);
      rateLimitedFetch('http://spotify.com/3').then(successHandler);

      await jest.runAllTimersAsync();

      expect(requestTimes).toEqual({
        'http://spotify.com/1': 100,
        'http://spotify.com/3': 200,
      });

      expect(abortHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry', () => {
    it(`should retry`, async () => {
      const startTime = Date.now();
      const requestTimes: number[] = [];
      const simpleFetchMock = async () => {
        requestTimes.push(Date.now() - startTime);
        throw new Error('some error');
      };

      const retryingFetch = new FetchBuilder().retry({ maxRetries: 3, delay: 100, backoff: 2 }).build(simpleFetchMock);

      expect(retryingFetch('http://test.com')).rejects.toThrow('some error');

      await jest.runAllTimersAsync();

      expect(requestTimes).toEqual([0, 100, 300, 700]);
    });

    it(`shouldn't retry aborted requests`, async () => {
      const simpleFetchMock = jest.fn().mockRejectedValue(new Error('aborted'));
      const retryingFetch = new FetchBuilder().retry().build(simpleFetchMock);

      expect(retryingFetch('http://test.com', { signal: AbortSignal.abort() })).rejects.toThrow();

      await jest.runAllTimersAsync();

      expect(simpleFetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('aborts requests after timeout milliseconds', async () => {
      const startTime = Date.now();
      const simpleFetchMock = () => new Promise<Response>(() => {});
      const timeoutFetch = new FetchBuilder().timeout(300).build(simpleFetchMock);

      expect(timeoutFetch('http://test.com')).rejects.toThrow('timeout');

      await jest.runAllTimersAsync();

      expect(Date.now()).toBe(startTime + 300);
    });
  });

  describe('rejectNotOk', () => {
    const simpleFetchMock = jest.fn();

    const rejectingFetch = new FetchBuilder().rejectNotOk().build(simpleFetchMock);

    it('passes on 200 responses', async () => {
      const response = new Response(null, { status: 200 });
      simpleFetchMock.mockResolvedValue(response);
      await expect(rejectingFetch('http://test.com')).resolves.toBe(response);
    });

    it('turns non 200 codes into errors', async () => {
      for (const status of [301, 404, 500]) {
        simpleFetchMock.mockResolvedValue(new Response(null, { status, statusText: 'error' }));
        await expect(rejectingFetch('http://test.com')).rejects.toThrow(`${status}: error`);
      }
    });
  });

  describe('limitPending', () => {
    const simpleFetchMock = jest.fn();

    const limitedFetch = new FetchBuilder().limitPending(10).build(simpleFetchMock);

    it('allows up to maxPending open requests', async () => {
      const successful: Promise<Response>[] = [];

      simpleFetchMock.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(new Response()), 1);
          }),
      );
      for (let i = 0; i < 10; i++) {
        successful.push(limitedFetch('http://test.com'));
      }
      const failed = expect(limitedFetch('http://test.com')).rejects.toThrow('Number of pending requests exceeded');

      await jest.advanceTimersByTimeAsync(1);

      await Promise.all(successful);
      await failed;

      expect(simpleFetchMock).toHaveBeenCalledTimes(10);
    });
  });

  describe('modifyRequest', () => {
    it('can modify the request', async () => {
      const simpleFetchMock = jest.fn();
      simpleFetchMock.mockResolvedValue(new Response());
      const requestModifyingFetch = new FetchBuilder()
        .modifyRequest(async request => new Request(`${request.url}modified`, request))
        .build(simpleFetchMock);

      await requestModifyingFetch('http://test.com');

      expect(simpleFetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://test.com/modified' }));
    });
  });
});

function timeoutSignal(milliseconds: number): AbortSignal {
  const abortController = new AbortController();
  setTimeout(() => abortController.abort(), milliseconds);
  return abortController.signal;
}
