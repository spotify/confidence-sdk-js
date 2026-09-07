// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingPluginName } from '@spotify-confidence/csr-common';
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
    expect(recordSpy.mock.calls[0][0].blockSelector).toBe('[data-csr-block],video');
  });

  it('rebuilds blocked elements as labelled inert placeholders', () => {
    new RrwebEngine().start({}, () => {});
    const plugin = recordSpy.mock.calls[0][0].plugins.find(
      ({ name }: { name: string }) => name === RecordingPluginName.BlockedElementLabels,
    );
    const event = {
      type: 2,
      timestamp: 1,
      data: {
        node: {
          type: 0,
          id: 1,
          childNodes: [
            {
              type: 2,
              id: 2,
              tagName: 'video',
              attributes: { rr_width: '640px', rr_height: '360px' },
              childNodes: [],
            },
          ],
        },
      },
    };

    expect(plugin.eventProcessor(event)).toEqual({
      ...event,
      data: {
        node: {
          type: 0,
          id: 1,
          childNodes: [
            {
              type: 2,
              id: 2,
              tagName: 'div',
              attributes: {
                rr_width: '640px',
                rr_height: '360px',
                'data-csr-blocked-element': 'video',
              },
              childNodes: [],
            },
          ],
        },
      },
    });
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

  it('records copy, cut, and paste actions without reading clipboard contents', () => {
    new RrwebEngine().start({}, () => {});
    const plugin = recordSpy.mock.calls[0][0].plugins.find(
      ({ name }: { name: string }) => name === RecordingPluginName.Clipboard,
    );
    const getId = vi.fn().mockReturnValue(42);
    plugin.getMirror({ nodeMirror: { getId } });
    const callback = vi.fn();
    const removeObserver = plugin.observer(callback, window);
    const input = document.createElement('input');
    document.body.appendChild(input);

    for (const action of ['copy', 'cut', 'paste']) {
      const event = new Event(action, { bubbles: true });
      Object.defineProperty(event, 'clipboardData', {
        get: () => {
          throw new Error('clipboard contents must not be read');
        },
      });
      expect(() => input.dispatchEvent(event)).not.toThrow();
    }

    expect(callback.mock.calls.map(([payload]) => payload)).toEqual([
      { action: 'copy', targetId: 42 },
      { action: 'cut', targetId: 42 },
      { action: 'paste', targetId: 42 },
    ]);
    expect(getId).toHaveBeenCalledTimes(3);

    removeObserver();
    input.dispatchEvent(new Event('paste', { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(3);
    input.remove();
  });

  it('keeps native click modifiers through a browser microtask checkpoint', async () => {
    new RrwebEngine().start({}, () => {});
    const plugin = recordSpy.mock.calls[0][0].plugins.find(
      ({ name }: { name: string }) => name === RecordingPluginName.ClickModifiers,
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
    // Browsers can run a microtask checkpoint between the window capture
    // listener above and rrweb's document listener for a trusted click.
    await Promise.resolve();

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
      ({ name }: { name: string }) => name === RecordingPluginName.ClickModifiers,
    );
    const removeObserver = plugin.observer(() => {}, window);
    document.dispatchEvent(new MouseEvent('click', { metaKey: true }));
    await new Promise(resolve => window.setTimeout(resolve, 0));

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
