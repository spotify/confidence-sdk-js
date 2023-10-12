import { ErrorCode, Logger, ProviderStatus } from '@openfeature/web-sdk';
import { ConfidenceClient, Configuration } from '@spotify-confidence/client-http';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

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
} as unknown as ConfidenceClient;

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
      schema: { bool: 'boolean' },
    },
  },
  resolveToken: 'before-each',
  context: {},
};
const dummyConsole: Logger = {
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};
describe('ConfidenceServerProvider', () => {
  let instanceUnderTest: ConfidenceServerProvider;

  beforeEach(() => {
    instanceUnderTest = new ConfidenceServerProvider(mockClient);
    resolveMock.mockResolvedValue(dummyConfiguration);
  });

  it('should change the provider status to READY', async () => {
    expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
  });

  it('should make a network request on each flag resolve', async () => {
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole);
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole);

    expect(resolveMock).toHaveBeenCalledTimes(2);
  });

  describe('apply', () => {
    it('should send an apply event', async () => {
      await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole);

      expect(mockApply).toHaveBeenCalledWith(dummyConfiguration.resolveToken, 'testFlag');
    });
  });

  describe('resolveBooleanEvaluation', () => {
    it('should resolve a boolean', async () => {
      expect(await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: true,
      });
    });

    it('should resolve a boolean from a nested struct', async () => {
      expect(await instanceUnderTest.resolveBooleanEvaluation('testFlag.obj.bool', false, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: true,
      });
    });

    it('should return default if the flag is not found', async () => {
      const actual = await instanceUnderTest.resolveBooleanEvaluation('notARealFlag.bool', false, {}, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      const actual = await instanceUnderTest.resolveBooleanEvaluation('testFlag.str', false, {}, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      const actual = await instanceUnderTest.resolveBooleanEvaluation('testFlag.404', false, {}, dummyConsole);

      expect(actual).toEqual({
        value: false,
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveNumberEvaluation', () => {
    it('should resolve a int', async () => {
      expect(await instanceUnderTest.resolveNumberEvaluation('testFlag.int', 1, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3,
      });
    });

    it('should resolve a double', async () => {
      expect(await instanceUnderTest.resolveNumberEvaluation('testFlag.dub', 1.5, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3.5,
      });
    });

    it('should resolve a int from a nested obj', async () => {
      expect(await instanceUnderTest.resolveNumberEvaluation('testFlag.obj.int', 1, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3,
      });
    });

    it('should resolve a double from a nested obg', async () => {
      expect(await instanceUnderTest.resolveNumberEvaluation('testFlag.obj.dub', 1.5, {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 3.5,
      });
    });

    it('should return default if the flag is not found', async () => {
      const actual = await instanceUnderTest.resolveNumberEvaluation('notARealFlag.int', 1, {}, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      const actual = await instanceUnderTest.resolveNumberEvaluation('testFlag.str', 1, {}, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      const actual = await instanceUnderTest.resolveNumberEvaluation('testFlag.404', 1, {}, dummyConsole);

      expect(actual).toEqual({
        value: 1,
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveStringEvaluation', () => {
    it('should resolve a string', async () => {
      expect(await instanceUnderTest.resolveStringEvaluation('testFlag.str', 'default', {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 'control',
      });
    });

    it('should resolve a string from a nested obj', async () => {
      expect(await instanceUnderTest.resolveStringEvaluation('testFlag.obj.str', 'default', {}, dummyConsole)).toEqual({
        variant: 'control',
        flagMetadata: {
          resolveToken: 'before-each',
        },
        reason: 'TARGETING_MATCH',
        value: 'obj string',
      });
    });

    it('should return default if the flag is not found', async () => {
      const actual = await instanceUnderTest.resolveStringEvaluation('notARealFlag.str', 'default', {}, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      const actual = await instanceUnderTest.resolveStringEvaluation('testFlag.int', 'default', {}, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type from nested obj', async () => {
      const actual = await instanceUnderTest.resolveStringEvaluation('testFlag.obj.int', 'default', {}, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      const actual = await instanceUnderTest.resolveStringEvaluation('testFlag.404', 'default', {}, dummyConsole);

      expect(actual).toEqual({
        value: 'default',
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });

  describe('resolveObjectEvaluation', () => {
    it('should resolve a full object', async () => {
      expect(await instanceUnderTest.resolveObjectEvaluation('testFlag.obj', {}, {}, dummyConsole)).toEqual({
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
      expect(
        await instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            bool: false,
          },
          {},
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

    it('should resolve a full object with type mismatch default', async () => {
      expect(
        await instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            testBool: false,
          },
          {},
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

    it('should return default if the flag is not found', async () => {
      const actual = await instanceUnderTest.resolveObjectEvaluation('notARealFlag.obj', {}, {}, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        reason: 'ERROR',
      });
    });

    it('should return default if the flag requested is the wrong type', async () => {
      const actual = await instanceUnderTest.resolveObjectEvaluation('testFlag.str', {}, {}, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.TYPE_MISMATCH,
        reason: 'ERROR',
      });
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      const actual = await instanceUnderTest.resolveObjectEvaluation('testFlag.404', {}, {}, dummyConsole);

      expect(actual).toEqual({
        value: {},
        errorCode: ErrorCode.PARSE_ERROR,
        reason: 'ERROR',
      });
    });
  });
});
