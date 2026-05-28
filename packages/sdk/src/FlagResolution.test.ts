import { FlagResolution } from './FlagResolution';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason } from './generated/confidence/flags/resolver/v1/types';

function makeResponse(overrides: Partial<Parameters<typeof makeResolvedFlag>[0]> = {}): ResolveFlagsResponse {
  return {
    resolvedFlags: [makeResolvedFlag(overrides)],
    resolveToken: new Uint8Array(),
    resolveId: 'test-resolve-id',
  };
}

function makeResolvedFlag({
  flag = 'flags/test-flag',
  variant = 'flags/test-flag/variants/treatment',
  value = { my_bool: true, my_string: 'hello' } as { [key: string]: any } | undefined,
  reason = ResolveReason.RESOLVE_REASON_MATCH,
  shouldApply = true,
  flagSchema = {
    schema: {
      my_bool: { boolSchema: {} },
      my_string: { stringSchema: {} },
    },
  } as any,
} = {}) {
  return { flag, variant, value, reason, shouldApply, flagSchema };
}

describe('FlagResolution', () => {
  describe('evaluate with null property values', () => {
    it('should return defaultValue when a resolved property is null', () => {
      const response = makeResponse({
        value: { my_bool: true, my_string: null },
      });
      const resolution = FlagResolution.ready({}, response);

      const result = resolution.evaluate('test-flag.my_string', 'fallback');

      expect(result.reason).toBe('MATCH');
      expect(result.value).toBe('fallback');
    });

    it('should return the resolved value when property is not null', () => {
      const response = makeResponse({
        value: { my_bool: true, my_string: 'hello' },
      });
      const resolution = FlagResolution.ready({}, response);

      const result = resolution.evaluate('test-flag.my_string', 'fallback');

      expect(result.reason).toBe('MATCH');
      expect(result.value).toBe('hello');
    });

    it('should return defaultValue when a resolved boolean property is null', () => {
      const response = makeResponse({
        value: { my_bool: null, my_string: 'hello' },
      });
      const resolution = FlagResolution.ready({}, response);

      const result = resolution.evaluate('test-flag.my_bool', false);

      expect(result.reason).toBe('MATCH');
      expect(result.value).toBe(false);
    });
  });
});
