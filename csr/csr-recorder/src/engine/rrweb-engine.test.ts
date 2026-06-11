import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RrwebEngine } from './rrweb-engine';

const recordSpy = vi.fn().mockReturnValue(() => {});

vi.mock('rrweb', () => ({
  record: (opts: unknown) => recordSpy(opts),
}));

describe('RrwebEngine', () => {
  beforeEach(() => recordSpy.mockClear());

  it('defaults maskAllInputs=true when maskInputs is omitted', () => {
    new RrwebEngine().start({}, () => {});
    expect(recordSpy.mock.calls[0][0].maskAllInputs).toBe(true);
  });

  it('forwards maskInputs=false to maskAllInputs', () => {
    new RrwebEngine().start({ maskInputs: false }, () => {});
    expect(recordSpy.mock.calls[0][0].maskAllInputs).toBe(false);
  });

  it('joins maskSelectors with `,` for maskTextSelector', () => {
    new RrwebEngine().start(
      { maskSelectors: ['.private', '[data-pii]'] },
      () => {},
    );
    expect(recordSpy.mock.calls[0][0].maskTextSelector).toBe(
      '.private,[data-pii]',
    );
  });

  it('omits maskTextSelector when maskSelectors is explicitly empty', () => {
    new RrwebEngine().start({ maskSelectors: [] }, () => {});
    expect(recordSpy.mock.calls[0][0]).not.toHaveProperty('maskTextSelector');
  });

  it('applies default maskTextSelector when maskSelectors is absent', () => {
    new RrwebEngine().start({}, () => {});
    expect(recordSpy.mock.calls[0][0].maskTextSelector).toBe('[data-csr-mask]');
  });

  it('joins blockSelectors with `,` for blockSelector', () => {
    new RrwebEngine().start(
      { blockSelectors: ['video', '.third-party'] },
      () => {},
    );
    expect(recordSpy.mock.calls[0][0].blockSelector).toBe('video,.third-party');
  });

  it('omits blockSelector when blockSelectors is explicitly empty', () => {
    new RrwebEngine().start({ blockSelectors: [] }, () => {});
    expect(recordSpy.mock.calls[0][0]).not.toHaveProperty('blockSelector');
  });

  it('applies default blockSelector when blockSelectors is absent', () => {
    new RrwebEngine().start({}, () => {});
    expect(recordSpy.mock.calls[0][0].blockSelector).toBe('[data-csr-block]');
  });

  it('throttles mousemove to 100ms and records only last input value', () => {
    new RrwebEngine().start({}, () => {});
    const opts = recordSpy.mock.calls[0][0];
    expect(opts.sampling).toEqual({ mousemove: 100, input: 'last' });
  });

  it('enables slimDOMOptions to strip head noise', () => {
    new RrwebEngine().start({}, () => {});
    expect(recordSpy.mock.calls[0][0].slimDOMOptions).toBe('all');
  });
});
