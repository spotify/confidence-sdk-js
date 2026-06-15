// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { observeFlags, type FlagWrite } from './flag-observer';

describe('observeFlags', () => {
  beforeEach(() => {
    delete (window as any).__confidence;
  });

  it('calls back when a flag is written after observation starts', () => {
    const writes: FlagWrite[] = [];
    observeFlags(w => writes.push(w));

    (window as any).__confidence.flags['my-flag'] = { variant: 'treatment-a' };

    expect(writes).toEqual([{ flagKey: 'my-flag', variant: 'treatment-a' }]);
  });

  it('emits snapshot entries for pre-existing flags', () => {
    (window as any).__confidence = {
      flags: {
        'flag-a': { variant: 'v1' },
        'flag-b': { variant: 'v2' },
      },
    };

    const writes: FlagWrite[] = [];
    observeFlags(w => writes.push(w));

    expect(writes).toContainEqual({ flagKey: 'flag-a', variant: 'v1' });
    expect(writes).toContainEqual({ flagKey: 'flag-b', variant: 'v2' });
  });

  it('observes new writes after reading the snapshot', () => {
    (window as any).__confidence = {
      flags: { existing: { variant: 'old' } },
    };

    const writes: FlagWrite[] = [];
    observeFlags(w => writes.push(w));

    (window as any).__confidence.flags['new-flag'] = { variant: 'new' };

    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual({ flagKey: 'existing', variant: 'old' });
    expect(writes[1]).toEqual({ flagKey: 'new-flag', variant: 'new' });
  });

  it('cleanup replaces proxy with plain copy', () => {
    const writes: FlagWrite[] = [];
    const cleanup = observeFlags(w => writes.push(w));

    (window as any).__confidence.flags['flag-a'] = { variant: 'v1' };
    expect(writes).toHaveLength(1);

    cleanup();

    (window as any).__confidence.flags['flag-b'] = { variant: 'v2' };
    expect(writes).toHaveLength(1);
  });

  it('preserves data after cleanup', () => {
    observeFlags(() => {});
    (window as any).__confidence.flags['my-flag'] = { variant: 'treatment' };

    const cleanup = observeFlags(() => {});
    cleanup();

    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'treatment' });
  });

  it('ignores writes with missing variant', () => {
    const writes: FlagWrite[] = [];
    observeFlags(w => writes.push(w));

    (window as any).__confidence.flags['bad'] = { noVariant: true };

    expect(writes).toHaveLength(0);
  });

  it('ignores writes with non-string variant', () => {
    const writes: FlagWrite[] = [];
    observeFlags(w => writes.push(w));

    (window as any).__confidence.flags['bad'] = { variant: 42 };

    expect(writes).toHaveLength(0);
  });

  it('initializes window.__confidence if not present', () => {
    observeFlags(() => {});

    expect((window as any).__confidence).toBeDefined();
    expect((window as any).__confidence.flags).toBeDefined();
  });
});
