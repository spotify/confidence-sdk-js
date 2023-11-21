import {
  FlagNotFoundError,
  Logger,
  ParseError,
  ProviderStatus,
  TypeMismatchError,
  InvalidContextError,
} from '@openfeature/js-sdk';
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
    ['no-seg-flag']: {
      name: 'no-seg-flag',
      variant: '',
      reason: Configuration.ResolveReason.NoSegmentMatch,
      value: undefined,
      schema: 'undefined',
    },
    ['targeting-error-flag']: {
      name: 'targeting-error-flag',
      variant: '',
      reason: Configuration.ResolveReason.TargetingKeyError,
      value: { enabled: true },
      schema: { enabled: 'boolean' },
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

  it('should throw invalid context error when the reason from confidence is targeting key error', async () => {
    expect(() =>
      instanceUnderTest.resolveBooleanEvaluation('targeting-error-flag.enabled', false, {}, dummyConsole),
    ).rejects.toThrow(InvalidContextError);
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

    it('should resolve default when accessing a flag with no segment match', async () => {
      expect(await instanceUnderTest.resolveBooleanEvaluation('no-seg-flag.enabled', false, {}, dummyConsole)).toEqual({
        reason: 'DEFAULT',
        value: false,
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
      expect(() =>
        instanceUnderTest.resolveBooleanEvaluation('notARealFlag.bool', false, {}, dummyConsole),
      ).rejects.toThrow(new FlagNotFoundError('Flag "notARealFlag" was not found'));
    });

    it('should return default if the flag requested is the wrong type', async () => {
      expect(() => instanceUnderTest.resolveBooleanEvaluation('testFlag.str', false, {}, dummyConsole)).rejects.toThrow(
        TypeMismatchError,
      );
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      expect(() => instanceUnderTest.resolveBooleanEvaluation('testFlag.404', false, {}, dummyConsole)).rejects.toThrow(
        ParseError,
      );
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
      expect(() => instanceUnderTest.resolveNumberEvaluation('notARealFlag.int', 1, {}, dummyConsole)).rejects.toThrow(
        FlagNotFoundError,
      );
    });

    it('should return default if the flag requested is the wrong type', async () => {
      expect(() => instanceUnderTest.resolveNumberEvaluation('testFlag.str', 1, {}, dummyConsole)).rejects.toThrow(
        TypeMismatchError,
      );
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      expect(() => instanceUnderTest.resolveNumberEvaluation('testFlag.404', 1, {}, dummyConsole)).rejects.toThrow(
        ParseError,
      );
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
      expect(() =>
        instanceUnderTest.resolveStringEvaluation('notARealFlag.str', 'default', {}, dummyConsole),
      ).rejects.toThrow(new FlagNotFoundError('Flag "notARealFlag" was not found'));
    });

    it('should return default if the flag requested is the wrong type', async () => {
      expect(() =>
        instanceUnderTest.resolveStringEvaluation('testFlag.int', 'default', {}, dummyConsole),
      ).rejects.toThrow(TypeMismatchError);
    });

    it('should return default if the flag requested is the wrong type from nested obj', async () => {
      expect(() =>
        instanceUnderTest.resolveStringEvaluation('testFlag.obj.int', 'default', {}, dummyConsole),
      ).rejects.toThrow(TypeMismatchError);
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      expect(() =>
        instanceUnderTest.resolveStringEvaluation('testFlag.404', 'default', {}, dummyConsole),
      ).rejects.toThrow(ParseError);
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
      expect(() =>
        instanceUnderTest.resolveObjectEvaluation(
          'testFlag.obj',
          {
            testBool: false,
          },
          {},
          dummyConsole,
        ),
      ).rejects.toThrow(TypeMismatchError);
    });

    it('should return default if the flag is not found', async () => {
      expect(() => instanceUnderTest.resolveObjectEvaluation('notARealFlag.obj', {}, {}, dummyConsole)).rejects.toThrow(
        new FlagNotFoundError('Flag "notARealFlag" was not found'),
      );
    });

    it('should return default if the flag requested is the wrong type', async () => {
      expect(() => instanceUnderTest.resolveObjectEvaluation('testFlag.str', {}, {}, dummyConsole)).rejects.toThrow(
        TypeMismatchError,
      );
    });

    it('should return default if the value requested is not in the flag schema', async () => {
      expect(() => instanceUnderTest.resolveObjectEvaluation('testFlag.404', {}, {}, dummyConsole)).rejects.toThrow(
        ParseError,
      );
    });
  });
});
