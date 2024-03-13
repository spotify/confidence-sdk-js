import {
  ErrorCode,
  EvaluationContext,
  Logger,
  OpenFeatureAPI,
  ProviderEvents,
  ProviderStatus,
} from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence, ResolveContext } from '@spotify-confidence/sdk';
import { Configuration } from '@spotify-confidence/client-http';

const mockApply = jest.fn();
jest.mock('@spotify-confidence/client-http', () => {
  return {
    ...jest.requireActual('@spotify-confidence/client-http'),
    ApplyManager: jest.fn().mockImplementation(() => ({
      apply: mockApply,
    })),
  };
});

const resolveMock = jest.fn();
const mockClient = {
  resolve: resolveMock,
  apply: jest.fn(),
} as unknown as Confidence;

const dummyContext: ResolveContext = { targeting_key: 'test' };
const dummyEvaluationContext: EvaluationContext = { targetingKey: 'test' };

const dummyConfiguration: Configuration = {
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
      reason: Configuration.ResolveReason.Match,
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
      reason: Configuration.ResolveReason.Match,
      schema: {
        bool: 'boolean',
      },
    },
    ['no-seg-flag']: {
      name: 'no-seg-flag',
      variant: '',
      reason: Configuration.ResolveReason.NoSegmentMatch,
      value: undefined,
      schema: 'undefined',
    },
  },
  resolveToken: 'before-each',
  context: dummyContext,
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

        expect(resolveMock).toHaveBeenCalledWith(
          {
            targeting_key: 'test',
          },
          {
            flags: [],
          },
        );
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

      expect(resolveMock).toHaveBeenCalledWith(
        {
          targeting_key: 'test1',
        },
        {
          flags: [],
          apply: false,
        },
      );
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
      instanceUnderTest.resolveBooleanEvaluation('no-seg-flag.enabled', false, dummyEvaluationContext, dummyConsole);

      expect(mockApply).toHaveBeenCalledWith(dummyConfiguration.resolveToken, 'no-seg-flag');
    });

    it('should send an apply event', async () => {
      await instanceUnderTest.initialize(dummyContext);
      instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, dummyEvaluationContext, dummyConsole);

      expect(mockApply).toHaveBeenCalledWith(dummyConfiguration.resolveToken, 'testFlag');
    });
  });

  describe('resolveBooleanEvaluation', () => {
    it('should resolve a boolean', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, dummyEvaluationContext, dummyConsole),
      ).toEqual({
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
        instanceUnderTest.resolveBooleanEvaluation('no-seg-flag.enabled', false, dummyEvaluationContext, dummyConsole),
      ).toEqual({
        reason: 'DEFAULT',
        value: false,
      });
    });

    it('should resolve a boolean from a nested struct', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveBooleanEvaluation('testFlag.obj.bool', false, dummyEvaluationContext, dummyConsole),
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
      const actual = instanceUnderTest.resolveBooleanEvaluation(
        'testFlag.bool',
        false,
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation(
        'notARealFlag.bool',
        false,
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation(
        'testFlag.str',
        false,
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveBooleanEvaluation(
        'testFlag.404',
        false,
        dummyEvaluationContext,
        dummyConsole,
      );

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

      expect(
        instanceUnderTest.resolveNumberEvaluation('testFlag.int', 1, dummyEvaluationContext, dummyConsole),
      ).toEqual({
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

      expect(
        instanceUnderTest.resolveNumberEvaluation('testFlag.dub', 1.5, dummyEvaluationContext, dummyConsole),
      ).toEqual({
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

      expect(
        instanceUnderTest.resolveNumberEvaluation('testFlag.obj.int', 1, dummyEvaluationContext, dummyConsole),
      ).toEqual({
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

      expect(
        instanceUnderTest.resolveNumberEvaluation('testFlag.obj.dub', 1.5, dummyEvaluationContext, dummyConsole),
      ).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3.5,
      });
    });

    it('should return default if the provider is not ready', () => {
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.int', 1, dummyEvaluationContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation(
        'notARealFlag.int',
        1,
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.str', 1, dummyEvaluationContext, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveNumberEvaluation('testFlag.404', 1, dummyEvaluationContext, dummyConsole);

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

      expect(
        instanceUnderTest.resolveStringEvaluation('testFlag.str', 'default', dummyEvaluationContext, dummyConsole),
      ).toEqual({
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
        instanceUnderTest.resolveStringEvaluation('testFlag.obj.str', 'default', dummyEvaluationContext, dummyConsole),
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
      const actual = instanceUnderTest.resolveStringEvaluation(
        'testFlag.str',
        'default',
        dummyEvaluationContext,
        dummyConsole,
      );

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
        dummyEvaluationContext,
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
      const actual = instanceUnderTest.resolveStringEvaluation(
        'testFlag.int',
        'default',
        dummyEvaluationContext,
        dummyConsole,
      );

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
        dummyEvaluationContext,
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
      const actual = instanceUnderTest.resolveStringEvaluation(
        'testFlag.404',
        'default',
        dummyEvaluationContext,
        dummyConsole,
      );

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

      expect(
        instanceUnderTest.resolveObjectEvaluation('testFlag.obj', {}, dummyEvaluationContext, dummyConsole),
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

    it('should resolve a full object with partial default', async () => {
      await instanceUnderTest.initialize(dummyContext);

      expect(
        instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            bool: false,
          },
          dummyEvaluationContext,
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

      expect(instanceUnderTest.resolveObjectEvaluation('testFlag', {}, dummyEvaluationContext, dummyConsole)).toEqual({
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
          dummyEvaluationContext,
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
      const actual = instanceUnderTest.resolveObjectEvaluation(
        'testFlag.obj',
        {},
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.PROVIDER_NOT_READY,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag is not found', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation(
        'notARealFlag.obj',
        {},
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation(
        'testFlag.str',
        {},
        dummyEvaluationContext,
        dummyConsole,
      );

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      await instanceUnderTest.initialize(dummyContext);
      const actual = instanceUnderTest.resolveObjectEvaluation(
        'testFlag.404',
        {},
        dummyEvaluationContext,
        dummyConsole,
      );

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
