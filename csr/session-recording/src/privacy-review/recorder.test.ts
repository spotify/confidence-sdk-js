import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecordingEvent } from '@spotify-confidence/csr-common';

const record = vi.hoisted(() => vi.fn());
vi.mock('@spotify-confidence/csr-recorder', () => ({
  record,
  DEFAULT_MASK_SELECTORS: ['[data-csr-mask]'],
  DEFAULT_BLOCK_SELECTORS: ['[data-csr-block]', 'video'],
}));

import { startPrivacyReviewRecording } from './index';

const fullSnapshot = { type: 2, timestamp: 1, data: {} } as RecordingEvent;

describe('startPrivacyReviewRecording', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('captures locally with the supplied masking settings and stops once', () => {
    const stopCapture = vi.fn();
    const event = { type: 4, timestamp: 1, data: { width: 100, height: 100 } } as RecordingEvent;
    record.mockImplementationOnce(onEvent => {
      onEvent(event);
      return stopCapture;
    });
    const fetch = vi.fn();
    const WebSocket = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('WebSocket', WebSocket);

    const review = startPrivacyReviewRecording({ masking: { level: 'text', selectors: ['.private'] } });
    expect(review.isRecording).toBe(true);
    expect(record).toHaveBeenCalledWith(expect.any(Function), {
      maskSelectors: ['.private'],
      maskAllText: true,
      maskInputs: true,
    });
    expect(review.stop()).toEqual([event]);
    expect(review.stop()).toEqual([event]);
    expect(review.isRecording).toBe(false);
    expect(stopCapture).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(WebSocket).not.toHaveBeenCalled();
  });

  it('downloads a self-contained review without letting recorded HTML close its data element', async () => {
    const event = {
      type: 4,
      timestamp: 1,
      data: { href: '</script><img src="https://example.invalid">$&' },
    } as RecordingEvent;
    const stopCapture = vi.fn();
    record.mockImplementationOnce(onEvent => {
      onEvent(event);
      return stopCapture;
    });
    const link = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-review');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const review = startPrivacyReviewRecording();
    review.download();

    expect(stopCapture).toHaveBeenCalledOnce();
    expect(link.download).toBe('confidence-privacy-review.html');
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/html;charset=utf-8');
    const html = await blob.text();
    expect(html).not.toContain('<!-- EMBEDDED_RECORDING -->');
    expect(html).not.toContain('</script><img src="https://example.invalid">');
    const embedded = html.match(/<script id="embedded-recording" type="application\/json">([^<]*)<\/script>/)?.[1];
    expect(JSON.parse(embedded!)).toEqual({
      format: 'csr-privacy-review-v1',
      events: [event],
      findings: [],
      suggestion: { masking: { selectors: [], attributes: [] } },
      config: {
        masking: { level: 'inputs', selectors: ['[data-csr-mask]'], attributes: [] },
        blocking: { selectors: ['[data-csr-block]', 'video'] },
      },
    });
  });

  it('reports success only after the local replay has loaded', async () => {
    const stopCapture = vi.fn();
    record.mockImplementationOnce(onEvent => {
      onEvent(fullSnapshot);
      return stopCapture;
    });
    const opened = {
      opener: {} as object | null,
      closed: false,
      location: { href: 'blob:local-review' },
      document: { documentElement: { dataset: { privacyReviewReady: 'true' } }, readyState: 'complete' },
    };
    const open = vi.fn(() => opened);
    const addEventListener = vi.fn();
    vi.stubGlobal('window', { open, addEventListener, removeEventListener: vi.fn() });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-review');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const review = startPrivacyReviewRecording();
    expect(await review.preview()).toBe('opened');

    expect(stopCapture).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith('blob:local-review', '_blank');
    expect(opened.opener).toBeNull();
    expect(addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function), { once: true });
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('text/html;charset=utf-8');
    expect(revokeObjectURL).not.toHaveBeenCalled();
    addEventListener.mock.calls[0][1]();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-review');
  });

  it('reports a blocked preview tab and releases its blob URL', async () => {
    record.mockImplementationOnce(onEvent => {
      onEvent(fullSnapshot);
      return vi.fn();
    });
    vi.stubGlobal('window', { open: () => null });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-preview');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(await startPrivacyReviewRecording().preview()).toBe('popup-blocked');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked-preview');
  });

  it('reports a viewer blocked by CSP and closes the empty tab', async () => {
    record.mockImplementationOnce(onEvent => {
      onEvent(fullSnapshot);
      return vi.fn();
    });
    const close = vi.fn();
    const opened = {
      opener: {} as object | null,
      closed: false,
      close,
      location: { href: 'blob:blocked-viewer' },
      document: { documentElement: { dataset: {} }, readyState: 'complete' },
    };
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { open: () => opened, addEventListener: vi.fn(), removeEventListener });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-viewer');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(await startPrivacyReviewRecording().preview()).toBe('viewer-blocked');
    expect(close).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked-viewer');
    expect(removeEventListener).toHaveBeenCalledOnce();
  });

  it('does not open a tab when nothing replayable was captured', async () => {
    const stopCapture = vi.fn();
    record.mockImplementationOnce(onEvent => {
      onEvent({ type: 4, timestamp: 1, data: { width: 100, height: 100 } } as RecordingEvent);
      return stopCapture;
    });
    const open = vi.fn();
    vi.stubGlobal('window', { open });

    expect(await startPrivacyReviewRecording().preview()).toBe('empty');
    expect(stopCapture).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it('embeds possible personal data findings and a suggested config in the review', async () => {
    const snapshot = {
      type: 2,
      timestamp: 5,
      data: {
        node: {
          type: 0,
          id: 1,
          childNodes: [
            {
              type: 2,
              id: 2,
              tagName: 'p',
              attributes: { id: 'greeting', title: 'jane@example.com' },
              childNodes: [{ type: 3, id: 3, textContent: 'Hi jane@example.com' }],
            },
          ],
        },
      },
    } as RecordingEvent;
    record.mockImplementationOnce(onEvent => {
      onEvent(snapshot);
      return vi.fn();
    });
    const link = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-review');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    startPrivacyReviewRecording().download();

    const html = await (createObjectURL.mock.calls[0][0] as Blob).text();
    const embedded = html.match(/<script id="embedded-recording" type="application\/json">([^<]*)<\/script>/)?.[1];
    const data = JSON.parse(embedded!);
    expect(data.findings).toHaveLength(2);
    expect(data.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'email', location: 'text', selector: '#greeting', timestamp: 5 }),
        expect.objectContaining({ kind: 'email', location: 'attribute', attribute: 'title' }),
      ]),
    );
    expect(data.suggestion).toEqual({ masking: { selectors: ['#greeting'], attributes: ['title'] } });
  });

  it('embeds the context, the effective config and added events, without the panel selector', async () => {
    record.mockImplementationOnce(onEvent => {
      onEvent({ type: 2, timestamp: 1, data: { node: { type: 0, id: 1, childNodes: [] } } } as RecordingEvent);
      return vi.fn();
    });
    const link = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
    vi.stubGlobal('document', { createElement: () => link, body: { appendChild: vi.fn() } });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-review');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const tag = { type: 6, timestamp: 2, data: { plugin: 'csr:tag', payload: { key: 'plan', value: 'pro' } } };

    const review = startPrivacyReviewRecording({
      context: { userAgent: { browser: 'chrome' }, team: 'checkout' },
      masking: { level: 'text', attributes: ['href'] },
      blocking: { selectors: ['.widget', '[data-confidence-privacy-review-controls]'] },
    });
    review.addEvent(tag as RecordingEvent);
    review.download();
    review.addEvent(tag as RecordingEvent);

    const html = await (createObjectURL.mock.calls[0][0] as Blob).text();
    const data = JSON.parse(
      html.match(/<script id="embedded-recording" type="application\/json">([^<]*)<\/script>/)![1],
    );
    expect(data.context).toEqual({ userAgent: { browser: 'chrome' }, team: 'checkout' });
    expect(data.config).toEqual({
      masking: { level: 'text', selectors: ['[data-csr-mask]'], attributes: ['href'] },
      blocking: { selectors: ['.widget'] },
    });
    expect(data.events.filter((e: RecordingEvent) => e.type === 6)).toEqual([tag]);
  });

  it('drops interactions rrweb could not map to a node, like clicks in the review panel', () => {
    const click = (id: number) => ({ type: 3, timestamp: 1, data: { source: 2, type: 2, id, x: 0, y: 0 } });
    record.mockImplementationOnce(onEvent => {
      onEvent(click(-1) as RecordingEvent);
      onEvent(click(7) as RecordingEvent);
      return vi.fn();
    });
    expect(startPrivacyReviewRecording().stop()).toEqual([click(7)]);
  });
});
