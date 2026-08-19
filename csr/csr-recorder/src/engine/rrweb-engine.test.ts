// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RrwebEngine } from './rrweb-engine';

const recordSpy = vi.fn().mockReturnValue(() => {});
const takeFullSnapshotSpy = vi.fn();

vi.mock('rrweb', async importOriginal => ({
  ...(await importOriginal<typeof import('rrweb')>()),
  record: (opts: unknown) => recordSpy(opts),
  takeFullSnapshot: (isCheckout: boolean) => takeFullSnapshotSpy(isCheckout),
}));

describe('RrwebEngine', () => {
  beforeEach(() => {
    recordSpy.mockClear();
    takeFullSnapshotSpy.mockClear();
  });

  it('defaults maskAllInputs=true when maskInputs is omitted', () => {
    new RrwebEngine().start({}, () => {});
    expect(recordSpy.mock.calls[0][0].maskAllInputs).toBe(true);
  });

  it('forwards maskInputs=false to maskAllInputs', () => {
    new RrwebEngine().start({ maskInputs: false }, () => {});
    expect(recordSpy.mock.calls[0][0].maskAllInputs).toBe(false);
  });

  it('joins maskSelectors with `,` for maskTextSelector', () => {
    new RrwebEngine().start({ maskSelectors: ['.private', '[data-pii]'] }, () => {});
    expect(recordSpy.mock.calls[0][0].maskTextSelector).toBe('.private,[data-pii]');
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
    new RrwebEngine().start({ blockSelectors: ['video', '.third-party'] }, () => {});
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

  it('adds native click modifier keys to the rrweb click event', () => {
    new RrwebEngine().start({}, () => {});
    const plugin = recordSpy.mock.calls[0][0].plugins.find(
      ({ name }: { name: string }) => name === 'csr/click-modifiers@1',
    );
    const removeObserver = plugin.observer(() => {}, window);

    document.dispatchEvent(
      new MouseEvent('click', {
        button: 0,
        altKey: true,
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
      }),
    );

    expect(
      plugin.eventProcessor({
        type: 3,
        timestamp: 1,
        data: { source: 2, type: 2, id: 7, x: 10, y: 20 },
      }),
    ).toEqual({
      type: 3,
      timestamp: 1,
      data: {
        source: 2,
        type: 2,
        id: 7,
        x: 10,
        y: 20,
        button: 0,
        altKey: true,
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
      },
    });

    removeObserver();
  });

  it('does not add stale modifiers to a later click', async () => {
    new RrwebEngine().start({}, () => {});
    const plugin = recordSpy.mock.calls[0][0].plugins.find(
      ({ name }: { name: string }) => name === 'csr/click-modifiers@1',
    );
    const removeObserver = plugin.observer(() => {}, window);
    document.dispatchEvent(new MouseEvent('click', { metaKey: true }));
    await Promise.resolve();

    const event = {
      type: 3,
      timestamp: 1,
      data: { source: 2, type: 2, id: 7 },
    };
    expect(plugin.eventProcessor(event)).toBe(event);

    removeObserver();
  });

  it('takes a checkout snapshot when requested', () => {
    const engine = new RrwebEngine();

    engine.takeFullSnapshot();

    expect(takeFullSnapshotSpy).toHaveBeenCalledWith(true);
  });
});
