import { AppliedFlag, ConfidenceClient } from './ConfidenceClient';
import { Configuration, ResolveContext } from './Configuration';

describe('ConfidenceClient', () => {
  const mockFetch = jest.fn();
  const instanceUnderTest = new ConfidenceClient({
    clientSecret: 'test-secret',
    fetchImplementation: mockFetch,
    apply: true,
    region: 'eu',
  });

  describe('resolve', () => {
    it('should call resolve with the given options and context', async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            resolvedFlags: [],
            resolveToken: '',
          }),
      });
      const context: ResolveContext = {
        targeting_key: 'a',
      };
      const options = {
        apply: false,
        flags: ['test-flag'],
      };

      await instanceUnderTest.resolve(context, options);

      expect(mockFetch).toHaveBeenCalledWith(`https://resolver.eu.confidence.dev/v1/flags:resolve`, {
        method: 'POST',
        body: JSON.stringify({
          clientSecret: 'test-secret',
          evaluationContext: context,
          ...options,
        }),
      });
    });

    it('should call resolve with the context', async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            resolvedFlags: [],
            resolveToken: '',
          }),
      });
      const context: ResolveContext = {
        targeting_key: 'a',
      };

      await instanceUnderTest.resolve(context);

      expect(mockFetch).toHaveBeenCalledWith(`https://resolver.eu.confidence.dev/v1/flags:resolve`, {
        method: 'POST',
        body: JSON.stringify({
          clientSecret: 'test-secret',
          evaluationContext: context,
          apply: true,
        }),
      });
    });

    it('should throw any errors', async () => {
      mockFetch.mockRejectedValue(new Error('test-error'));
      const context: ResolveContext = {
        targeting_key: 'a',
      };

      await expect(instanceUnderTest.resolve(context)).rejects.toThrowError('test-error');
    });

    it('should return a valid configuration with the flags resolved', async () => {
      const fakeFlag = {
        flag: 'flags/test-flag',
        variant: 'test',
        value: {
          str: 'test',
        },
        flagSchema: { schema: { str: { stringSchema: {} } } },
        reason: Configuration.ResolveReason.Match,
      };
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            resolvedFlags: [fakeFlag],
            resolveToken: 'resolve-token',
          }),
      });
      const context: ResolveContext = {
        targeting_key: 'a',
      };

      const config = await instanceUnderTest.resolve(context);

      expect(config).toEqual({
        flags: {
          ['test-flag']: {
            name: 'test-flag',
            schema: {
              str: 'string',
            },
            value: {
              str: 'test',
            },
            reason: Configuration.ResolveReason.Match,
            variant: 'test',
          },
        },
        resolveToken: 'resolve-token',
        context,
      });
    });
  });

  describe('apply', () => {
    const fakeTime = new Date();
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(fakeTime);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should call apply with flags and resolve token', async () => {
      mockFetch.mockResolvedValue({});
      const resolveToken = 'apply-test-resolve-token';
      const flagsToApply: AppliedFlag[] = [
        {
          flag: 'test-flag',
          applyTime: fakeTime.toISOString(),
        },
      ];

      await instanceUnderTest.apply(flagsToApply, resolveToken);

      expect(mockFetch).toHaveBeenCalledWith(`https://resolver.eu.confidence.dev/v1/flags:apply`, {
        method: 'POST',
        body: JSON.stringify({
          clientSecret: 'test-secret',
          resolve_token: resolveToken,
          flags: flagsToApply,
          sendTime: fakeTime.toISOString(),
        }),
      });
    });

    it('should throw any errors', async () => {
      mockFetch.mockRejectedValue(new Error('test-error'));

      await expect(instanceUnderTest.apply([], 'test')).rejects.toThrowError('test-error');
    });
  });
});
