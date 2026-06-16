/**
 * @jest-environment jsdom
 */
import { publishFlagEvaluation } from './flag-evaluation-global';

describe('publishFlagEvaluation', () => {
  beforeEach(() => {
    delete (window as any).__confidence;
  });

  it('writes { variant } to window.__confidence.flags', () => {
    publishFlagEvaluation('my-flag', 'treatment-a');

    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'treatment-a' });
  });

  it('initializes window.__confidence and flags if missing', () => {
    expect((window as any).__confidence).toBeUndefined();

    publishFlagEvaluation('my-flag', 'control');

    expect((window as any).__confidence).toBeDefined();
    expect((window as any).__confidence.flags).toBeDefined();
    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'control' });
  });

  it('preserves existing flags object', () => {
    const existing = { 'other-flag': { variant: 'baseline' } };
    (window as any).__confidence = { flags: existing };

    publishFlagEvaluation('my-flag', 'treatment-a');

    expect((window as any).__confidence.flags).toBe(existing);
    expect(existing['other-flag']).toEqual({ variant: 'baseline' });
    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'treatment-a' });
  });

  it('deduplicates: skips write if variant is unchanged', () => {
    const flags: Record<string, { variant: string }> = {};
    (window as any).__confidence = { flags };
    const spy = jest.fn();
    const proxy = new Proxy(flags, {
      set(target, prop, value) {
        spy(prop, value);
        target[prop as string] = value;
        return true;
      },
    });
    (window as any).__confidence.flags = proxy;

    publishFlagEvaluation('my-flag', 'treatment-a');
    publishFlagEvaluation('my-flag', 'treatment-a');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('writes when variant changes for same flag', () => {
    publishFlagEvaluation('my-flag', 'treatment-a');
    publishFlagEvaluation('my-flag', 'treatment-b');

    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'treatment-b' });
  });

  it('supports multiple flags', () => {
    publishFlagEvaluation('flag-a', 'variant-1');
    publishFlagEvaluation('flag-b', 'variant-2');

    expect((window as any).__confidence.flags['flag-a']).toEqual({ variant: 'variant-1' });
    expect((window as any).__confidence.flags['flag-b']).toEqual({ variant: 'variant-2' });
  });
});
