import { describe, expect, it } from 'vitest';
import { resolvePrivacyOptions, type MaskingLevel } from './privacy-options';

describe('resolvePrivacyOptions', () => {
  it('defaults to masking inputs only', () => {
    expect(resolvePrivacyOptions({})).toEqual({ maskAllText: false, maskInputs: true });
  });

  it.each<[MaskingLevel, { maskAllText: boolean; maskInputs: boolean }]>([
    ['none', { maskAllText: false, maskInputs: false }],
    ['inputs', { maskAllText: false, maskInputs: true }],
    ['text', { maskAllText: true, maskInputs: true }],
  ])('maps level %s', (level, expected) => {
    expect(resolvePrivacyOptions({ masking: { level } })).toMatchObject(expected);
  });

  it('never masks text without also masking inputs', () => {
    expect(resolvePrivacyOptions({ masking: { level: 'text' }, maskInputs: false })).toMatchObject({
      maskAllText: true,
      maskInputs: true,
    });
  });

  it('prefers grouped options over deprecated flat ones and says so', () => {
    const messages: string[] = [];
    const resolved = resolvePrivacyOptions(
      {
        masking: { selectors: ['.new'], level: 'inputs' },
        blocking: { selectors: ['.new-block'] },
        maskSelectors: ['.old'],
        blockSelectors: ['.old-block'],
        maskInputs: false,
      },
      message => messages.push(message),
    );
    expect(resolved).toMatchObject({ maskSelectors: ['.new'], blockSelectors: ['.new-block'], maskInputs: true });
    expect(messages).toEqual([
      'maskSelectors, blockSelectors, maskInputs are deprecated; use masking and blocking',
      "masking.level 'inputs' overrides maskInputs: false",
    ]);
  });

  it('keeps deprecated flat options working on their own', () => {
    expect(resolvePrivacyOptions({ maskSelectors: ['.old'], blockSelectors: ['video'], maskInputs: false })).toEqual({
      maskSelectors: ['.old'],
      blockSelectors: ['video'],
      maskAllText: false,
      maskInputs: false,
    });
  });

  it('fails closed on an unknown level', () => {
    const messages: string[] = [];
    const resolved = resolvePrivacyOptions({ masking: { level: 'all' as MaskingLevel } }, m => messages.push(m));
    expect(resolved).toMatchObject({ maskAllText: true, maskInputs: true });
    expect(messages).toEqual(["SECURITY: unknown masking.level 'all'; masking all text"]);
  });
});
