import { FlagResolution } from './FlagResolution';
import { publishFlagEvaluation } from './flag-evaluation-global';
import { ResolveFlagsResponse } from './generated/confidence/flags/resolver/v1/api';
import { ResolveReason } from './generated/confidence/flags/resolver/v1/types';

jest.mock('./flag-evaluation-global');

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
  assignmentOrigin = '',
  flagSchema = {
    schema: {
      my_bool: { boolSchema: {} },
      my_string: { stringSchema: {} },
    },
  } as any,
} = {}) {
  return { flag, variant, value, reason, shouldApply, assignmentOrigin, flagSchema };
}

describe('FlagResolution', () => {
  describe('flag evaluation global', () => {
    it('publishes flag evaluation on MATCH', () => {
      const response = makeResponse();
      const resolution = FlagResolution.ready({}, response);

      resolution.evaluate('test-flag.my_bool', false);

      expect(publishFlagEvaluation).toHaveBeenCalledWith('flags/test-flag', 'flags/test-flag/variants/treatment', '');
    });

    it('does not publish on NO_SEGMENT_MATCH', () => {
      const response = makeResponse({ reason: ResolveReason.RESOLVE_REASON_NO_SEGMENT_MATCH });
      const resolution = FlagResolution.ready({}, response);

      resolution.evaluate('test-flag.my_bool', false);

      expect(publishFlagEvaluation).not.toHaveBeenCalled();
    });

    it('does not publish when flag is not found', () => {
      const response = makeResponse();
      const resolution = FlagResolution.ready({}, response);

      resolution.evaluate('nonexistent-flag.my_bool', false);

      expect(publishFlagEvaluation).not.toHaveBeenCalled();
    });
  });

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

describe('FlagResolution list flag values (deprecated, still supported)', () => {
  const flagSchema = {
    schema: {
      tags: { listSchema: { elementSchema: { stringSchema: {} } } },
      nested: { structSchema: { schema: { nums: { listSchema: { elementSchema: { intSchema: {} } } } } } },
    },
  } as any;
  const value = { tags: ['a', 'b'], nested: { nums: [1, 2, 3] } };

  it('resolves list properties against a listSchema', () => {
    const resolution = FlagResolution.ready({}, makeResponse({ value, flagSchema }));
    expect(resolution.evaluate('test-flag.tags', [] as string[])).toMatchObject({ value: ['a', 'b'], reason: 'MATCH' });
    expect(resolution.evaluate('test-flag.nested.nums', [] as number[])).toMatchObject({ value: [1, 2, 3] });
  });

  it('returns default on a list element type mismatch', () => {
    const resolution = FlagResolution.ready({}, makeResponse({ value, flagSchema }));
    expect(resolution.evaluate('test-flag.tags', 'x' as any)).toMatchObject({ value: 'x', reason: 'ERROR' });
  });
});
