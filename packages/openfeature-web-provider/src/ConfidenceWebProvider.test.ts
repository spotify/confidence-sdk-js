import {
  ErrorCode,
  EvaluationContext,
  Logger,
  OpenFeatureAPI,
  ProviderEvents,
  ProviderStatus,
} from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence, FlagResolution } from '@spotify-confidence/sdk';

const contextPutMock = jest.fn();
const resolveMock = jest.fn();
const applyMock = jest.fn();
const mockClient = {
  environment: 'client',
  resolve: resolveMock,
  apply: applyMock,
  put: contextPutMock,
} as unknown as Confidence;

const dummyContext: EvaluationContext = { targetingKey: 'test' };
// const dummyContext: EvaluationContext = { targetingKey: 'test' };

const dummyConfiguration: FlagResolution = {
  flags: {
    ['testFlag']: {
      name: 'testFlag',
      variant: 'control',
      value: {
        bool: true,
        str: 'control',
        int: 3,
        dub: 3.5,
        obj: {
          str: 'obj string',
          bool: true,
          int: 3,
          dub: 3.5,
        },
      },
      reason: FlagResolution.ResolveReason.Match,
      schema: {
        bool: 'boolean',
        str: 'string',
        int: 'number',
        dub: 'number',
        obj: {
          bool: 'boolean',
          str: 'string',
          int: 'number',
          dub: 'number',
        },
      },
    },
    ['anotherFlag']: {
      name: 'anotherFlag',
      variant: 'control',
      value: {
        bool: true,
      },
      reason: FlagResolution.ResolveReason.Match,
      schema: {
        bool: 'boolean',
      },
    },
    ['no-seg-flag']: {
      name: 'no-seg-flag',
      variant: '',
      reason: FlagResolution.ResolveReason.NoSegmentMatch,
      value: undefined,
      schema: 'undefined',
    },
  },
  resolveToken: 'before-each',
  context: { targeting_key: 'test' },
};
const dummyConsole: Logger = {
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};
describe('ConfidenceProvider', () => {
  let instanceUnderTest: ConfidenceWebProvider;

  beforeEach(() => {
    instanceUnderTest = new ConfidenceWebProvider(mockClient);
    resolveMock.mockResolvedValue(dummyConfiguration);
  });

  describe('initialize', () => {
    describe('with context', () => {
      it('should resolve', async () => {
        await instanceUnderTest.initialize({ targetingKey: 'test' });

        expect(resolveMock).toHaveBeenCalledWith([]);
      });

      it('should change the provider status to READY', async () => {
        expect(instanceUnderTest.status).toEqual(ProviderStatus.NOT_READY);

        await instanceUnderTest.initialize({ targetingKey: 'test' });

        expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
      });

      it('should set the status to ERROR if the fetch errors', async () => {
        resolveMock.mockRejectedValue(new Error('something went wrong'));

        try {
          await instanceUnderTest.initialize({ targetingKey: 'test' });
        } catch (_) {
          // do nothing
        }

        expect(instanceUnderTest.status).toEqual(ProviderStatus.ERROR);
      });
    });

    describe('no context', () => {
      it('should change the provider status to READY', async () => {
        expect(instanceUnderTest.status).toEqual(ProviderStatus.NOT_READY);

        await instanceUnderTest.initialize();

        expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
      });
    });

    it('should change the provider status with context', async () => {
      expect(instanceUnderTest.status).toEqual(ProviderStatus.NOT_READY);

      await instanceUnderTest.initialize();

      expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
    });
  });

  describe('onContextChange', () => {
    it('should resolve on onContextChange', async () => {
      await instanceUnderTest.onContextChange(dummyContext, { targetingKey: 'test1' });

      expect(contextPutMock).toHaveBeenCalledWith('openFeature', {
        targeting_key: 'test1',
      });
      expect(resolveMock).toHaveBeenCalledWith([]);
    });

    it('should not resolve on onContextChange with equal contexts', async () => {
      await instanceUnderTest.onContextChange(dummyContext, dummyContext);

      expect(resolveMock).not.toHaveBeenCalled();
    });

    it('should return default with reason stale during fetch', async () => {
      await instanceUnderTest.initialize({ targetingKey: 'A' });

      expect(
        instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, { targetingKey: 'B' }, dummyConsole),
      ).toEqual(
        expect.objectContaining({
          value: false,
          reason: 'STALE',
        }),
      );
    });

    it('should emit stale event if the context is different', async () => {
      const staleHandler = jest.fn();
      const readyHandler = jest.fn();
      instanceUnderTest.events.addHandler(ProviderEvents.Stale, staleHandler);
      instanceUnderTest.events.addHandler(ProviderEvents.Ready, readyHandler);

      await instanceUnderTest.onContextChange(dummyContext, { targetingKey: 'a' });

      expect(staleHandler).toHaveBeenCalledTimes(1);
      expect(readyHandler).toHaveBeenCalledTimes(1);
      expect(staleHandler).toHaveBeenCalledBefore(readyHandler);
    });

    it('should not emit stale event if the context the same', async () => {
      const staleHandler = jest.fn();
      const readyHandler = jest.fn();
      instanceUnderTest.events.addHandler(ProviderEvents.Stale, staleHandler);
      instanceUnderTest.events.addHandler(ProviderEvents.Ready, readyHandler);

      await instanceUnderTest.onContextChange(dummyContext, dummyContext);

      expect(staleHandler).toHaveBeenCalledTimes(0);
      expect(readyHandler).toHaveBeenCalledTimes(0);
    });
  });

  describe('apply', () => {
    it('should apply when a flag has no segment match', async () => {
      await instanceUnderTest.initialize(dummyContext);
      instanceUnderTest.resolveBooleanEvaluation('no-seg-flag.enabled', false, dummyContext, dummyConsole);

      expect(applyMock).toHaveBeenCalledWith(dummyConfiguration.resolveToken, 'no-seg-flag');
    });

    it('should send an apply event', async () => {
      await instanceUnderTest.initialize(dummyContext);
      instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, dummyContext, dummyConsole);

      expect(applyMock).toHaveBeenCalledWith(dummyConfiguration.resolveToken, 'testFlag');
    });
  });

  describe('resolveBooleanEvaluation', () => {
    it('should resolve a boolean', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: true,
      });
    });
    it('should resolve default when accessing a flag with no segment match', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveBooleanEvaluation('no-seg-flag.enabled', false, dummyContext, dummyConsole),
      ).toEqual({
        reason: 'DEFAULT',
        value: false,
      });
    });

    it('should resolve a boolean from a nested struct', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveBooleanEvaluation('testFlag.obj.bool', false, dummyContext, dummyConsole),
      ).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: true,
      });
    });

    it('should return default if the provider is not ready', () => {
      const actual = instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation('notARealFlag.bool', false, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation('testFlag.str', false, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation('testFlag.404', false, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveNumberEvaluation', () => {
    it('should resolve a int', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveNumberEvaluation('testFlag.int', 1, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3,
      });
    });

    it('should resolve a double', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveNumberEvaluation('testFlag.dub', 1.5, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3.5,
      });
    });

    it('should resolve a int from a nested obj', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveNumberEvaluation('testFlag.obj.int', 1, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3,
      });
    });

    it('should resolve a double from a nested obg', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveNumberEvaluation('testFlag.obj.dub', 1.5, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3.5,
      });
    });

    it('should return default if the provider is not ready', () => {
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.int', 1, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation('notARealFlag.int', 1, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.str', 1, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.404', 1, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveStringEvaluation', () => {
    it('should resolve a string', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveStringEvaluation('testFlag.str', 'default', dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 'control',
      });
    });

    it('should resolve a string from a nested obj', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveStringEvaluation('testFlag.obj.str', 'default', dummyContext, dummyConsole),
      ).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 'obj string',
      });
    });

    it('should return default if the provider is not ready', () => {
      const actual = instanceUnderTest.resolveStringEvaluation('testFlag.str', 'default', dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveStringEvaluation(
        'notARealFlag.str',
        'default',
        dummyContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveStringEvaluation('testFlag.int', 'default', dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type from nested obj', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveStringEvaluation(
        'testFlag.obj.int',
        'default',
        dummyContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveStringEvaluation('testFlag.404', 'default', dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveObjectEvaluation', () => {
    it('should resolve a full object', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveObjectEvaluation('testFlag.obj', {}, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: {
          str: 'obj string',
          bool: true,
          dub: 3.5,
          int: 3,
        },
      });
    });

    it('should resolve a full object with partial default', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            bool: false,
          },
          dummyContext,
          dummyConsole,
        ),
      ).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: {
          str: 'obj string',
          bool: true,
          dub: 3.5,
          int: 3,
        },
      });
    });

    it('should resolve the full flag object', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(instanceUnderTest.resolveObjectEvaluation('testFlag', {}, dummyContext, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: {
          bool: true,
          str: 'control',
          int: 3,
          dub: 3.5,
          obj: {
            str: 'obj string',
            bool: true,
            int: 3,
            dub: 3.5,
          },
        },
      });
    });

    it('should resolve a full object with type mismatch default', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            testBool: false,
          },
          dummyContext,
          dummyConsole,
        ),
      ).toEqual({
        errorCode: 'TYPE_MISMATCH',
        reason: 'ERROR',
        value: {
          testBool: false,
        },
      });
    });

    it('should return default if the provider is not ready', () => {
      const actual = instanceUnderTest.resolveObjectEvaluation('testFlag.obj', {}, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation('notARealFlag.obj', {}, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation('testFlag.str', {}, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation('testFlag.404', {}, dummyContext, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });
});

describe('events', () => {
  const openFeatureAPI = OpenFeatureAPI.getInstance();
  const readyHandler = jest.fn();
  const errorHandler = jest.fn();
  const staleHandler = jest.fn();

  beforeEach(async () => {
    await openFeatureAPI.clearProviders();
    openFeatureAPI.addHandler(ProviderEvents.Stale, staleHandler);
    openFeatureAPI.addHandler(ProviderEvents.Error, errorHandler);
    openFeatureAPI.addHandler(ProviderEvents.Ready, readyHandler);
  });

  afterEach(() => {
    openFeatureAPI.clearHandlers();
  });

  it('should emit ready stale ready on successful initialisation and context change', async () => {
    resolveMock.mockResolvedValue(dummyConfiguration);
    openFeatureAPI.setProvider(new ConfidenceWebProvider(mockClient));
    await openFeatureAPI.setContext({ targetingKey: 'user-a', name: 'Kurt' });

    expect(readyHandler).toHaveBeenCalledTimes(2);
    expect(staleHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledTimes(0);
  });

  it('should emit error stale error on failed initialisation and context change', async () => {
    resolveMock.mockRejectedValue(new Error('some error'));
    openFeatureAPI.setProvider(new ConfidenceWebProvider(mockClient));

    try {
      await openFeatureAPI.setContext({ targetingKey: 'user-a' });
    } catch (_) {
      // do nothing
    }

    expect(readyHandler).toHaveBeenCalledTimes(0);
    expect(staleHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledTimes(2);
  });
});
