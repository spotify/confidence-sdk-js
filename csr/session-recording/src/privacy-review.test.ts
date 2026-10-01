import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecordingEvent } from '@spotify-confidence/csr-common';

const record = vi.hoisted(() => vi.fn());
vi.mock('@spotify-confidence/csr-recorder', () => ({ record }));

import { startPrivacyReviewRecording } from './privacy-review';

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

    const review = startPrivacyReviewRecording({ maskSelectors: ['.private'], maskInputs: true });
    expect(review.isRecording).toBe(true);
    expect(record).toHaveBeenCalledWith(expect.any(Function), {
      maskSelectors: ['.private'],
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
    expect(JSON.parse(embedded!)).toEqual({ format: 'csr-privacy-review-v1', events: [event] });
  });

  it('reports success only after the local replay has loaded', async () => {
    const event = { type: 4, timestamp: 1, data: { width: 100, height: 100 } } as RecordingEvent;
    const stopCapture = vi.fn();
    record.mockImplementationOnce(onEvent => {
      onEvent(event);
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
    expect(await review.preview()).toBe(true);

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
    record.mockReturnValueOnce(vi.fn());
    vi.stubGlobal('window', { open: () => null });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-preview');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    expect(await startPrivacyReviewRecording().preview()).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked-preview');
  });

  it('reports a viewer blocked by CSP and closes the empty tab', async () => {
    record.mockReturnValueOnce(vi.fn());
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

    expect(await startPrivacyReviewRecording().preview()).toBe(false);
    expect(close).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blocked-viewer');
    expect(removeEventListener).toHaveBeenCalledOnce();
  });
});
