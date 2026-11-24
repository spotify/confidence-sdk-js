import { describe, expect, it, vi } from 'vitest';
import { createFlagSet } from './flag-set';

describe('createFlagSet', () => {
  it('prefixes flag names with flags/ unless already prefixed', () => {
    const flags = createFlagSet();
    expect(
      flags.set({ checkout: { variant: 'on' }, 'flags/banner': { variant: 'off', assignmentOrigin: 'rule' } }),
    ).toEqual([
      { flagKey: 'flags/checkout', variant: 'on', assignmentOrigin: '' },
      { flagKey: 'flags/banner', variant: 'off', assignmentOrigin: 'rule' },
    ]);
  });

  it('merges calls and only reports flags whose assignment changed', () => {
    const flags = createFlagSet();
    flags.set({ a: { variant: 'on' }, b: { variant: 'off' } });
    expect(flags.set({ a: { variant: 'on' }, b: { variant: 'on' } })).toEqual([
      { flagKey: 'flags/b', variant: 'on', assignmentOrigin: '' },
    ]);
    expect(flags.all()).toEqual([
      { flagKey: 'flags/a', variant: 'on', assignmentOrigin: '' },
      { flagKey: 'flags/b', variant: 'on', assignmentOrigin: '' },
    ]);
  });

  it('ignores entries without a string variant', () => {
    const logger = vi.fn();
    const flags = createFlagSet(logger);
    expect(flags.set({ bad: { variant: 1 as unknown as string }, '': { variant: 'on' } })).toEqual([]);
    expect(logger).toHaveBeenCalledTimes(2);
  });
});
