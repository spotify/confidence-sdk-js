import {
  CachingFlagResolverClient,
  FetchingFlagResolverClient,
  FlagResolverClient,
  PendingResolution,
  withRequestLogic,
} from './FlagResolverClient';
import { setMaxListeners } from 'node:events';
import { SdkId } from './generated/confidence/flags/resolver/v1/types';
import { abortableSleep } from './fetch-util';
import { ApplyFlagsRequest, ResolveFlagsRequest } from './generated/confidence/flags/resolver/v1/api';
import { FlagResolution } from './FlagResolution';
const RESOLVE_ENDPOINT = 'https://resolver.confidence.dev/v1/flags:resolve';
const APPLY_ENDPOINT = 'https://resolver.confidence.dev/v1/flags:apply';

setMaxListeners(50);

const dummyResolveToken = Uint8Array.from(atob('SGVsbG9Xb3JsZA=='), c => c.charCodeAt(0));

const resolveHandlerMock = jest.fn();
const applyHandlerMock = jest.fn();

const fetchImplementation = async (request: Request): Promise<Response> => {
  await abortableSleep(0, request.signal);

  let handler: (reqBody: any) => any;
  switch (request.url) {
    case 'https://resolver.confidence.dev/v1/flags:resolve':
      handler = data => resolveHandlerMock(ResolveFlagsRequest.fromJSON(data));
      break;
    case 'https://resolver.confidence.dev/v1/flags:apply':
      handler = data => applyHandlerMock(ApplyFlagsRequest.fromJSON(data));
      break;
    default:
      throw new Error(`Unknown url: ${request.url}`);
  }
  try {
    const result = await handler(await request.json());
    return new Response(JSON.stringify(result));
  } catch (e: any) {
    return new Response(null, { status: 500, statusText: e.message });
  }
};

resolveHandlerMock.mockImplementation(createFlagResolutionResponse);

describe('Client environment Evaluation', () => {
  // const flagResolutionResponseJson = JSON.stringify(createFlagResolutionResponse());
  const instanceUnderTest = new FetchingFlagResolverClient({
    fetchImplementation,
    clientSecret: 'secret',
    applyTimeout: 10,
    sdk: {
      id: SdkId.SDK_ID_JS_CONFIDENCE,
      version: 'test',
    },
    environment: 'client',
    resolveTimeout: 10,
  });

  describe('apply', () => {
    it('should send an apply event', async () => {
      const flagResolution = await instanceUnderTest.resolve({}, []);
      flagResolution.evaluate('testflag.bool', false);

      const [applyRequest] = await nextMockArgs(applyHandlerMock);
      expect(applyRequest).toMatchObject({
        clientSecret: 'secret',
        resolveToken: dummyResolveToken,
        sendTime: expect.any(Date),
        sdk: { id: 13, version: 'test' },
        flags: [
          {
            applyTime: expect.any(Date),
            flag: 'flags/testflag',
          },
        ],
      });
    });
  });

  it('should apply when a flag has no segment match', async () => {
    const flagResolution = await instanceUnderTest.resolve({}, []);
    flagResolution.evaluate('no-seg-flag.enabled', false);
    const [applyRequest] = await nextMockArgs(applyHandlerMock);
    expect(applyRequest).toMatchObject({
      clientSecret: 'secret',
      resolveToken: dummyResolveToken,
      sendTime: expect.any(Date),
      sdk: { id: 13, version: 'test' },
      flags: [
        {
          applyTime: expect.any(Date),
          flag: 'flags/no-seg-flag',
        },
      ],
    });
  });
});

describe('Backend environment Evaluation', () => {
  const instanceUnderTest = new FetchingFlagResolverClient({
    fetchImplementation,
    clientSecret: 'secret',
    sdk: {
      id: SdkId.SDK_ID_JS_CONFIDENCE,
      version: 'test',
    },
    environment: 'backend',
    resolveTimeout: 10,
  });

  it('should resolve a full flag object', async () => {
    const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
    expect(flagResolution.evaluate('testflag', {})).toEqual({
      variant: 'flags/testflag/variants/control',
      reason: 'MATCH',
      value: {
        bool: true,
        str: 'string',
        int: 3,
        double: 3.5,
        obj: {
          str: 'string',
          bool: true,
          int: 3,
          obj: {},
          double: 3.5,
        },
      },
    });
  });

  it('should resolve a full object with partial default', async () => {
    const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
    expect(
      flagResolution.evaluate('testflag.obj', {
        bool: false,
      }),
    ).toEqual({
      variant: 'flags/testflag/variants/control',
      reason: 'MATCH',
      value: {
        str: 'string',
        bool: true,
        double: 3.5,
        obj: {},
        int: 3,
      },
    });
  });

  it('should resolve a full object with type mismatch default', async () => {
    const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
    expect(
      flagResolution.evaluate('testflag.obj', {
        testBool: false,
      }),
    ).toEqual({
      errorCode: 'TYPE_MISMATCH',
      errorMessage: "Expected undefined, but found Struct, at path 'defaultValue.obj.testBool'",
      reason: 'ERROR',
      value: {
        testBool: false,
      },
    });
  });

  describe.each`
    type         | path         | incorrectPath | incorrectPathType | defaultValue | expectedValue
    ${'Boolean'} | ${'.bool'}   | ${'.str'}     | ${typeof 'str'}   | ${false}     | ${true}
    ${'String'}  | ${'.str'}    | ${'.bool'}    | ${typeof false}   | ${'default'} | ${'string'}
    ${'Double'}  | ${'.double'} | ${'.bool'}    | ${typeof false}   | ${3.0}       | ${3.5}
    ${'Integer'} | ${'.int'}    | ${'.bool'}    | ${typeof false}   | ${4}         | ${3}
  `(`resolve $type Evaluation`, ({ path, incorrectPath, incorrectPathType, defaultValue, expectedValue }) => {
    it('should resolve a match', async () => {
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      expect(flagResolution.evaluate(`testflag${path}`, defaultValue)).toEqual({
        variant: 'flags/testflag/variants/control',
        reason: 'MATCH',
        value: expectedValue,
      });
    });

    it('should resolve NO_SEGMENT_MATCH when accessing a flag with no segment match', async () => {
      const flagResolution = await instanceUnderTest.resolve({}, ['no-seg-flag']);
      expect(flagResolution.evaluate(`no-seg-flag${path}`, defaultValue)).toEqual({
        reason: 'NO_SEGMENT_MATCH',
        value: defaultValue,
      });
    });

    it('should resolve from a nested struct', async () => {
      // path, defaultValue, value
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      expect(flagResolution.evaluate(`testflag.obj${path}`, defaultValue)).toEqual({
        variant: 'flags/testflag/variants/control',
        reason: 'MATCH',
        value: expectedValue,
      });
    });

    it('should return default if the flag is not found', async () => {
      // path, defaultValue, value
      const flagResolution = await instanceUnderTest.resolve({}, ['notARealFlag']);
      const actual = flagResolution.evaluate(`notARealFlag${path}`, defaultValue);

      expect(actual).toEqual({
        value: defaultValue,
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: 'Flag "notARealFlag" not found',
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      // path, defaultValue, value, incorrectTypePath
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      const actual = flagResolution.evaluate(`testflag${incorrectPath}`, defaultValue);

      expect(actual).toEqual({
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
        errorMessage: `Expected ${incorrectPathType}, but found ${typeof defaultValue}, at path 'defaultValue${incorrectPath}'`,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      // path, defaultValue, value
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      const actual = flagResolution.evaluate('testflag.404', defaultValue);

      expect(actual).toEqual({
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
        errorMessage: `Expected undefined, but found ${typeof defaultValue}, at path 'defaultValue.404'`,
        reason: 'ERROR',
      });
    });

    it('should return default if the nested flag requested is the wrong type', async () => {
      // path, defaultValue, value, incorrectTypePath
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      const actual = flagResolution.evaluate(`testflag.obj${incorrectPath}`, defaultValue);

      expect(actual).toEqual({
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
        errorMessage: `Expected ${incorrectPathType}, but found ${typeof defaultValue}, at path 'defaultValue.obj${incorrectPath}'`,
        reason: 'ERROR',
      });
    });

    it('should return default if the nested value requested is not in the flag schema', async () => {
      // path, defaultValue, value
      const flagResolution = await instanceUnderTest.resolve({}, ['testflag']);
      const actual = flagResolution.evaluate('testflag.obj.404', defaultValue);

      expect(actual).toEqual({
        value: defaultValue,
        errorCode: 'TYPE_MISMATCH',
        errorMessage: `Expected undefined, but found ${typeof defaultValue}, at path 'defaultValue.obj.404'`,
        reason: 'ERROR',
      });
    });
  });
});

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

describe('CachingFlagResolverClient', () => {
  const flagResolverClientMock = jest.mocked<FlagResolverClient>({
    resolve: jest.fn(),
  });
  it('should cache flag resolution', async () => {
    const context = { a: 0 };
    const mockResolution = jest.mocked<FlagResolution>({
      evaluate: jest.fn(),
      state: 'READY',
      context,
    });
    const pendingResolution = PendingResolution.create(context, () => Promise.resolve(mockResolution));
    const cachingClient = new CachingFlagResolverClient(flagResolverClientMock, 1000);
    flagResolverClientMock.resolve.mockReturnValue(pendingResolution);
    const first = await cachingClient.resolve(context, []);
    const second = await cachingClient.resolve(context, []);
    expect(first).toBe(second);
    expect(flagResolverClientMock.resolve).toHaveBeenCalledTimes(1);
  });

  it('should abort the original resolution when all references are aborted', () => {
    const context = { a: 0 };
    const pendingResolution = PendingResolution.create(context, () => new Promise(() => {}));
    const cachingClient = new CachingFlagResolverClient(flagResolverClientMock, 1000);
    flagResolverClientMock.resolve.mockReturnValue(pendingResolution);
    const firstResolution = cachingClient.resolve(context, []);
    const secondResolution = cachingClient.resolve(context, []);
    firstResolution.abort();
    firstResolution.abort();
    expect(pendingResolution.signal.aborted).toBe(false);
    secondResolution.abort();
    expect(pendingResolution.signal.aborted).toBe(true);
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

function createFlagResolutionResponse(): unknown {
  return {
    resolvedFlags: [
      {
        flag: 'flags/testflag',
        variant: 'flags/testflag/variants/control',
        value: {
          str: 'string',
          bool: true,
          obj: {
            str: 'string',
            bool: true,
            double: 3.5,
            obj: {},
            int: 3,
          },
          double: 3.5,
          int: 3,
        },
        flagSchema: {
          schema: {
            str: {
              stringSchema: {},
            },
            bool: {
              boolSchema: {},
            },
            double: {
              doubleSchema: {},
            },
            obj: {
              structSchema: {
                schema: {
                  str: {
                    stringSchema: {},
                  },
                  bool: {
                    boolSchema: {},
                  },
                  double: {
                    doubleSchema: {},
                  },
                  obj: {
                    structSchema: {
                      schema: {},
                    },
                  },
                  int: {
                    intSchema: {},
                  },
                },
              },
            },
            int: {
              intSchema: {},
            },
          },
        },
        reason: 'RESOLVE_REASON_MATCH',
      },
      {
        flag: 'flags/no-seg-flag',
        variant: '',
        value: {},
        reason: 'RESOLVE_REASON_NO_SEGMENT_MATCH',
      },
    ],
    resolveToken: 'SGVsbG9Xb3JsZA==',
    resolveId: 'resolve-id',
  };
}

function nextMockArgs<A extends any[]>(mock: jest.Mock<any, A>): Promise<A> {
  return new Promise(resolve => {
    const realImpl = mock.getMockImplementation();
    mock.mockImplementationOnce((...args: A) => {
      try {
        return realImpl?.(...args);
      } finally {
        resolve(args);
      }
    });
  });
}
