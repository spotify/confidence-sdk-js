// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingPluginName } from '@spotify-confidence/csr-common';
import { RrwebEngine } from './rrweb-engine';

const recordSpy = vi.fn().mockReturnValue(() => {});
const takeFullSnapshotSpy = vi.fn();
const consoleObserverSpy = vi.fn();

vi.mock('rrweb', async importOriginal => ({
  ...(await importOriginal<typeof import('rrweb')>()),
  record: (opts: unknown) => recordSpy(opts),
  takeFullSnapshot: (isCheckout: boolean) => takeFullSnapshotSpy(isCheckout),
}));

vi.mock('@rrweb/rrweb-plugin-console-record', () => ({
  getRecordConsolePlugin: (options: unknown) => ({
    name: 'rrweb/console@1',
    options,
    observer: (callback: (...args: unknown[]) => void) => {
      consoleObserverSpy(callback);
      return () => {};
    },
  }),
}));

function observeConsolePlugin(
  captureConsoleLogs: NonNullable<Parameters<RrwebEngine['start']>[0]['captureConsoleLogs']>,
  debugLogger?: (message: string) => void,
) {
  new RrwebEngine().start({ captureConsoleLogs, debugLogger }, () => {});
  const plugin = recordSpy.mock.calls[0][0].plugins.find(
    ({ name }: { name: string }) => name === RecordingPluginName.ConsoleLog,
  );
  const callback = vi.fn();
  plugin.observer(callback, window, plugin.options);

  return { callback, emitConsoleData: consoleObserverSpy.mock.calls[0][0] };
}

function blockedElementLabelsPlugin() {
  new RrwebEngine().start({}, () => {});
  return recordSpy.mock.calls[0][0].plugins.find(
    ({ name }: { name: string }) => name === RecordingPluginName.BlockedElementLabels,
  );
}

function fullSnapshotWithNode(node: unknown) {
  return {
    type: 2,
    timestamp: 1,
    data: {
      node: {
        type: 0,
        id: 1,
        childNodes: [node],
      },
    },
  };
}

function fullSnapshotWithIframe(id: number, attributes: Record<string, string>) {
  return fullSnapshotWithNode({ type: 2, id, tagName: 'iframe', attributes, childNodes: [] });
}

function attachIframeDocument(parentId: number, childNodes: unknown[] = []) {
  return {
    type: 3,
    timestamp: 2,
    data: {
      source: 0,
      adds: [
        {
          parentId,
          nextId: null,
          node: { type: 0, id: parentId + 1, childNodes },
        },
      ],
      removes: [],
      texts: [],
      attributes: [],
      isAttachIframe: true,
    },
  };
}

describe('RrwebEngine', () => {
  beforeEach(() => {
    recordSpy.mockClear();
    takeFullSnapshotSpy.mockClear();
    consoleObserverSpy.mockClear();
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

  it('drops iframe document attachments for blocked iframe placeholders', () => {
    const plugin = blockedElementLabelsPlugin();
    plugin.eventProcessor(fullSnapshotWithIframe(2, { rr_width: '640px', rr_height: '360px' }));
    const attachIframeEvent = attachIframeDocument(2);

    expect(plugin.eventProcessor(attachIframeEvent)).toEqual({
      ...attachIframeEvent,
      data: { ...attachIframeEvent.data, adds: [] },
    });
  });

  it('keeps iframe document attachments for unblocked iframes', () => {
    const plugin = blockedElementLabelsPlugin();
    plugin.eventProcessor(fullSnapshotWithIframe(2, {}));
    const attachIframeEvent = attachIframeDocument(2);
    const result = plugin.eventProcessor(attachIframeEvent);

    expect(result.data.adds).toHaveLength(1);
    expect(result.data.adds[0].parentId).toBe(2);
  });

  it('stops filtering attachments after a blocked iframe is removed', () => {
    const plugin = blockedElementLabelsPlugin();
    plugin.eventProcessor(fullSnapshotWithIframe(2, { rr_width: '640px', rr_height: '360px' }));
    plugin.eventProcessor({
      type: 3,
      timestamp: 2,
      data: {
        source: 0,
        adds: [],
        removes: [{ parentId: 1, id: 2 }],
        texts: [],
        attributes: [],
      },
    });

    expect(plugin.eventProcessor(attachIframeDocument(2)).data.adds).toHaveLength(1);
  });

  it('stops filtering attachments after an ancestor of a blocked iframe is removed', () => {
    const plugin = blockedElementLabelsPlugin();
    plugin.eventProcessor(
      fullSnapshotWithNode({
        type: 2,
        id: 2,
        tagName: 'div',
        attributes: {},
        childNodes: [
          {
            type: 2,
            id: 3,
            tagName: 'iframe',
            attributes: { rr_width: '640px', rr_height: '360px' },
            childNodes: [],
          },
        ],
      }),
    );
    plugin.eventProcessor({
      type: 3,
      timestamp: 2,
      data: {
        source: 0,
        adds: [],
        removes: [{ parentId: 1, id: 2 }],
        texts: [],
        attributes: [],
      },
    });

    expect(plugin.eventProcessor(attachIframeDocument(3)).data.adds).toHaveLength(1);
  });

  it('does not track blocked iframes inside discarded iframe documents', () => {
    const plugin = blockedElementLabelsPlugin();
    plugin.eventProcessor(fullSnapshotWithIframe(2, { rr_width: '640px', rr_height: '360px' }));
    plugin.eventProcessor(
      attachIframeDocument(2, [
        {
          type: 2,
          id: 4,
          tagName: 'iframe',
          attributes: { rr_width: '640px', rr_height: '360px' },
          childNodes: [],
        },
      ]),
    );

    expect(plugin.eventProcessor(attachIframeDocument(4)).data.adds).toHaveLength(1);
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

  it('strips query strings and fragments from console payloads and traces', () => {
    const { callback, emitConsoleData } = observeConsolePlugin({ levels: ['error'], sanitize: true });

    emitConsoleData({
      level: 'error',
      payload: [
        'Stripe failed at https://api.stripe.com/intents/pi_1?client_secret=secret#result',
        'socket wss://events.example/stream?subscriber=user-1 and //cdn.example/script.js?token=secret',
      ],
      trace: ['at checkout (/checkout?subscriber=user-1#payment:10:2)'],
    });

    expect(callback).toHaveBeenCalledWith({
      level: 'error',
      payload: [
        'Stripe failed at https://api.stripe.com/intents/pi_1',
        'socket wss://events.example/stream and //cdn.example/script.js',
      ],
      trace: ['at checkout (/checkout)'],
    });
  });

  it('keeps raw console data when sanitization is not configured', () => {
    const { callback, emitConsoleData } = observeConsolePlugin({ levels: ['error'] });
    const data = {
      level: 'error',
      payload: ['https://api.example.com/payment?client_secret=secret'],
      trace: [],
    };

    emitConsoleData(data);

    expect(callback).toHaveBeenCalledWith(data);
  });

  it('uses a custom sanitizer for every console payload and trace string', () => {
    const { callback, emitConsoleData } = observeConsolePlugin({
      levels: ['error'],
      sanitize: value => value.replaceAll('secret', '[REDACTED]'),
    });

    emitConsoleData({
      level: 'error',
      payload: ['secret'],
      trace: ['secret trace'],
    });

    expect(callback).toHaveBeenCalledWith({
      level: 'error',
      payload: ['[REDACTED]'],
      trace: ['[REDACTED] trace'],
    });
  });

  it('drops console events and logs when a custom sanitizer throws', () => {
    const debugLogger = vi.fn();
    const { callback, emitConsoleData } = observeConsolePlugin(
      {
        levels: ['error'],
        sanitize: () => {
          throw new Error('sanitizer bug');
        },
      },
      debugLogger,
    );

    emitConsoleData({
      level: 'error',
      payload: ['client_secret=secret', 'subscriber=user-1'],
      trace: ['secret'],
    });
    emitConsoleData({ level: 'error', payload: ['another secret'], trace: [] });

    expect(callback).not.toHaveBeenCalled();
    expect(debugLogger).toHaveBeenCalledWith(expect.stringMatching(/SECURITY.*console.*dropped/i));
    expect(debugLogger).toHaveBeenCalledTimes(1);
    expect(debugLogger.mock.calls.join(' ')).not.toContain('client_secret=secret');
  });

  it('drops malformed console plugin data instead of asserting its type', () => {
    const debugLogger = vi.fn();
    const { callback, emitConsoleData } = observeConsolePlugin({ sanitize: true }, debugLogger);

    emitConsoleData({ level: 'error', payload: 'not-an-array', trace: [] });

    expect(callback).not.toHaveBeenCalled();
    expect(debugLogger).toHaveBeenCalledWith(expect.stringMatching(/SECURITY.*console.*dropped/i));
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
