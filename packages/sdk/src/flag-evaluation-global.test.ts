/**
 * @jest-environment jsdom
 */
import { publishFlagEvaluation } from './flag-evaluation-global';

describe('publishFlagEvaluation', () => {
  beforeEach(() => {
    delete (window as any).__confidence;
  });

  it('writes { variant, assignmentOrigin } to window.__confidence.flags', () => {
    publishFlagEvaluation('my-flag', 'treatment-a', 'rule-1');

    expect((window as any).__confidence.flags['my-flag']).toEqual({
      variant: 'treatment-a',
      assignmentOrigin: 'rule-1',
    });
  });

  it('initializes window.__confidence and flags if missing', () => {
    expect((window as any).__confidence).toBeUndefined();

    publishFlagEvaluation('my-flag', 'control', '');

    expect((window as any).__confidence).toBeDefined();
    expect((window as any).__confidence.flags).toBeDefined();
    expect((window as any).__confidence.flags['my-flag']).toEqual({ variant: 'control', assignmentOrigin: '' });
  });

  it('preserves existing flags object', () => {
    const existing = { 'other-flag': { variant: 'baseline', assignmentOrigin: '' } };
    (window as any).__confidence = { flags: existing };

    publishFlagEvaluation('my-flag', 'treatment-a', 'rule-1');

    expect((window as any).__confidence.flags).toBe(existing);
    expect(existing['other-flag']).toEqual({ variant: 'baseline', assignmentOrigin: '' });
    expect((window as any).__confidence.flags['my-flag']).toEqual({
      variant: 'treatment-a',
      assignmentOrigin: 'rule-1',
    });
  });

  it('deduplicates: skips write if variant is unchanged', () => {
    const flags: Record<string, { variant: string; assignmentOrigin: string }> = {};
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

    publishFlagEvaluation('my-flag', 'treatment-a', 'rule-1');
    publishFlagEvaluation('my-flag', 'treatment-a', 'rule-1');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('writes when variant changes for same flag', () => {
    publishFlagEvaluation('my-flag', 'treatment-a', 'rule-1');
    publishFlagEvaluation('my-flag', 'treatment-b', 'rule-2');

    expect((window as any).__confidence.flags['my-flag']).toEqual({
      variant: 'treatment-b',
      assignmentOrigin: 'rule-2',
    });
  });

  it('supports multiple flags', () => {
    publishFlagEvaluation('flag-a', 'variant-1', 'rule-1');
    publishFlagEvaluation('flag-b', 'variant-2', 'rule-2');

    expect((window as any).__confidence.flags['flag-a']).toEqual({ variant: 'variant-1', assignmentOrigin: 'rule-1' });
    expect((window as any).__confidence.flags['flag-b']).toEqual({ variant: 'variant-2', assignmentOrigin: 'rule-2' });
  });
});
