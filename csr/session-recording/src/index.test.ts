import { afterEach, describe, expect, it, vi } from 'vitest';

const createUploader = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => vi.fn());

vi.mock('@spotify-confidence/csr-common/uploader', () => ({
  createUploader,
  buildSessionContext: (custom: object) => ({ userAgent: { browser: 'test' }, ...custom }),
}));
vi.mock('@spotify-confidence/csr-recorder', () => ({
  record,
}));

import { RecordingPluginName } from '@spotify-confidence/csr-common';

import { initSessionRecorder } from './index';

function flushPromises() {
  return new Promise(r => setTimeout(r, 0));
}

function mockUploader() {
  const fn = Object.assign(vi.fn(), { close: vi.fn() });
  return fn;
}

describe('initSessionRecorder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('always returns a SessionRecorder', () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const recorder = initSessionRecorder({ clientSecret: 'secret' });

    expect(recorder.start).toBeTypeOf('function');
    expect(recorder.stop).toBeTypeOf('function');
  });

  it('automatic mode inits and records immediately', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    expect(createUploader).toHaveBeenCalledOnce();
    expect(createUploader.mock.calls[0][0]).not.toHaveProperty('forceRecord');
    expect(record).toHaveBeenCalledOnce();
  });

  it('forwards deprecated flat privacy options to record', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const ctx = { buildVersion: '2.3.1' };
    initSessionRecorder({
      clientSecret: 'secret',
      context: ctx,
      maskSelectors: ['.private'],
      blockSelectors: ['video', '.third-party'],
      maskInputs: false,
    });
    await flushPromises();

    expect(createUploader.mock.calls[0][0]).toMatchObject({
      apiUrl: 'https://recording.confidence.dev',
      websocketUrl: 'wss://recording-ws.confidence.dev/sessions/stream',
      clientSecret: 'secret',
      context: ctx,
    });
    expect(record.mock.calls[0][1]).toEqual({
      maskSelectors: ['.private'],
      blockSelectors: ['video', '.third-party'],
      maskInputs: false,
      maskAllText: false,
    });
  });

  it('forwards grouped masking and blocking options to record', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    initSessionRecorder({
      clientSecret: 'secret',
      masking: { level: 'text', selectors: ['.pii'], attributes: ['href'] },
      blocking: { selectors: ['.widget'] },
    });
    await flushPromises();

    expect(record.mock.calls[0][1]).toEqual({
      maskSelectors: ['.pii'],
      maskAttributes: ['href'],
      maskAllText: true,
      maskInputs: true,
      blockSelectors: ['.widget'],
    });
  });

  it('automatic mode does not call record when backend skips', async () => {
    createUploader.mockResolvedValueOnce(null);

    initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    expect(record).not.toHaveBeenCalled();
  });

  it('does not throw when createUploader rejects', async () => {
    createUploader.mockRejectedValueOnce(new Error('boom'));

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    expect(recorder).toBeDefined();
  });

  it('surfaces createUploader errors via debugLogger', async () => {
    createUploader.mockRejectedValueOnce(new Error('worker-load-failed: worker-src'));

    const logger = vi.fn();
    initSessionRecorder({ clientSecret: 'secret', debugLogger: logger });
    await flushPromises();

    expect(logger).toHaveBeenCalledWith(expect.stringContaining('worker-load-failed'));
  });

  it('forwards the CSR_DEBUG logger to capture sanitizers', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});
    vi.stubGlobal('sessionStorage', { getItem: vi.fn().mockReturnValue('true') });
    const consoleLogger = vi.spyOn(console, 'log').mockImplementation(() => {});

    initSessionRecorder({
      clientSecret: 'secret',
      captureNetworkRequests: { sanitize: true },
    });
    await flushPromises();
    const debugLogger = record.mock.calls[0][1].debugLogger;
    debugLogger('SECURITY: network sanitizer failed; captured event dropped');

    expect(consoleLogger).toHaveBeenCalledWith('[CSR] SECURITY: network sanitizer failed; captured event dropped');
  });

  it('forwards workerUrl to createUploader', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    initSessionRecorder({
      clientSecret: 'secret',
      workerUrl: '/assets/confidence-worker.js',
    });
    await flushPromises();

    expect(createUploader.mock.calls[0][0]).toMatchObject({
      workerUrl: '/assets/confidence-worker.js',
    });
  });

  it('manual mode does not init until start is called', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const recorder = initSessionRecorder({
      clientSecret: 'secret',
      mode: 'manual',
    });
    await flushPromises();

    expect(createUploader).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();

    recorder.start();
    await flushPromises();

    expect(createUploader).toHaveBeenCalledOnce();
    expect(createUploader.mock.calls[0][0]).not.toHaveProperty('forceRecord');
    expect(createUploader.mock.calls[0][0]).toMatchObject({
      apiUrl: 'https://recording.confidence.dev',
      websocketUrl: 'wss://recording-ws.confidence.dev/sessions/stream',
      clientSecret: 'secret',
    });
    expect(record).toHaveBeenCalledOnce();
  });

  it('manual mode handles a backend skip without recording or throwing', async () => {
    createUploader.mockResolvedValueOnce(null);

    const recorder = initSessionRecorder({
      clientSecret: 'secret',
      mode: 'manual',
    });

    expect(() => recorder.start()).not.toThrow();
    await flushPromises();

    expect(createUploader).toHaveBeenCalledOnce();
    expect(record).not.toHaveBeenCalled();
    expect(recorder.isRecording).toBe(false);
  });

  it('start is a no-op in automatic mode', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    recorder.start();
    await flushPromises();

    expect(createUploader).toHaveBeenCalledOnce();
  });

  it('stop tears down the recorder and closes the transport', async () => {
    const stopFn = vi.fn();
    const uploader = mockUploader();
    createUploader.mockResolvedValueOnce(uploader);
    record.mockReturnValueOnce(stopFn);

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    recorder.stop();
    expect(stopFn).toHaveBeenCalledOnce();
    expect(uploader.close).toHaveBeenCalledOnce();

    recorder.stop();
    expect(stopFn).toHaveBeenCalledOnce();
    expect(uploader.close).toHaveBeenCalledOnce();
  });

  it('isRecording reflects recording state', async () => {
    const stopFn = vi.fn();
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(stopFn);

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    expect(recorder.isRecording).toBe(false);

    await flushPromises();
    expect(recorder.isRecording).toBe(true);

    recorder.stop();
    expect(recorder.isRecording).toBe(false);
  });

  it('isRecording is false in manual mode before start', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const recorder = initSessionRecorder({
      clientSecret: 'secret',
      mode: 'manual',
    });
    await flushPromises();

    expect(recorder.isRecording).toBe(false);

    recorder.start();
    await flushPromises();

    expect(recorder.isRecording).toBe(true);
  });

  it('stop before init completes prevents recording', async () => {
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(() => {});

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    recorder.stop();
    await flushPromises();

    expect(record).not.toHaveBeenCalled();
  });

  it('restarts capture with a fresh snapshot when the uploader replaces an expired session', async () => {
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    createUploader.mockResolvedValueOnce(mockUploader());
    record.mockReturnValueOnce(firstStop).mockReturnValueOnce(secondStop);

    const recorder = initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    createUploader.mock.calls[0][0].onSessionRestart();

    expect(firstStop).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1]).toEqual(record.mock.calls[0]);
    expect(recorder.isRecording).toBe(true);
  });

  it('replays already-evaluated flags into the replacement recording', async () => {
    vi.stubGlobal('window', {
      __confidence: { flags: { checkout: { variant: 'treatment', assignmentOrigin: 'resolver' } } },
    });
    const uploader = mockUploader();
    createUploader.mockResolvedValueOnce(uploader);
    record.mockReturnValue(vi.fn());

    initSessionRecorder({ clientSecret: 'secret' });
    await flushPromises();

    const flagEvaluations = () =>
      uploader.mock.calls.filter(
        ([event]) => (event as { data?: { plugin?: string } })?.data?.plugin === RecordingPluginName.FlagEvaluation,
      );

    expect(flagEvaluations()).toHaveLength(1);

    createUploader.mock.calls[0][0].onSessionRestart();

    // The replacement recording needs the assignment too, not just evaluations that happen
    // to occur after the restart.
    expect(flagEvaluations()).toHaveLength(2);
    expect(flagEvaluations()[1][0]).toMatchObject({
      data: { payload: { flagKey: 'checkout', variant: 'treatment' } },
    });
  });
  describe('setFlags', () => {
    const flagEvaluations = (uploader: ReturnType<typeof mockUploader>) =>
      uploader.mock.calls
        .filter(
          ([event]) => (event as { data?: { plugin?: string } })?.data?.plugin === RecordingPluginName.FlagEvaluation,
        )
        .map(([event]) => (event as { data: { payload: unknown } }).data.payload);

    it('sends prefixed flag evaluations once recording', async () => {
      const uploader = mockUploader();
      createUploader.mockResolvedValueOnce(uploader);
      record.mockReturnValue(vi.fn());

      const recorder = initSessionRecorder({ clientSecret: 'secret' });
      await flushPromises();
      recorder.setFlags({ checkout: { variant: 'treatment', assignmentOrigin: 'rule' }, banner: { variant: 'off' } });
      recorder.setFlags({ checkout: { variant: 'treatment', assignmentOrigin: 'rule' } });

      expect(flagEvaluations(uploader)).toEqual([
        { flagKey: 'flags/checkout', variant: 'flags/checkout/variants/treatment', assignmentOrigin: 'rule' },
        { flagKey: 'flags/banner', variant: 'flags/banner/variants/off', assignmentOrigin: '' },
      ]);
    });

    it('sends flags set before start when recording begins, and again after a restart', async () => {
      const uploader = mockUploader();
      createUploader.mockResolvedValueOnce(uploader);
      record.mockReturnValue(vi.fn());

      const recorder = initSessionRecorder({ clientSecret: 'secret', mode: 'manual' });
      recorder.setFlags({ checkout: { variant: 'treatment' } });
      recorder.start();
      await flushPromises();

      expect(flagEvaluations(uploader)).toEqual([
        { flagKey: 'flags/checkout', variant: 'flags/checkout/variants/treatment', assignmentOrigin: '' },
      ]);

      createUploader.mock.calls[0][0].onSessionRestart();

      expect(flagEvaluations(uploader)).toHaveLength(2);
    });
  });
});

describe('review mode', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  function reviewModule() {
    const destroy = vi.fn();
    const addEvent = vi.fn();
    return { mount: vi.fn(() => ({ destroy, addEvent })), destroy, addEvent };
  }

  it('mounts the review with the same privacy options and never uploads or records', async () => {
    vi.stubGlobal('document', { body: {} });
    const review = reviewModule();
    const debugLogger = vi.fn();

    const recorder = initSessionRecorder({
      clientSecret: 'secret',
      review,
      masking: { level: 'text', selectors: ['.pii'] },
      blocking: { selectors: ['.widget'] },
      captureConsoleLogs: { sanitize: true },
      captureNetworkRequests: true,
      debugLogger,
    });
    recorder.start();
    recorder.tag('k', 'v');
    await flushPromises();

    expect(createUploader).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(review.mount).toHaveBeenCalledWith(
      expect.objectContaining({
        masking: { level: 'text', selectors: ['.pii'] },
        blocking: { selectors: ['.widget'] },
        captureConsoleLogs: { sanitize: true },
        captureNetworkRequests: true,
        debugLogger: expect.any(Function),
      }),
    );
    expect(recorder.isRecording).toBe(false);
    recorder.stop();
    expect(review.destroy).toHaveBeenCalledOnce();
  });

  it('sends the session context, tags, measures and flags to the review instead of uploading', () => {
    vi.stubGlobal('document', { body: {} });
    const review = reviewModule();

    const recorder = initSessionRecorder({
      clientSecret: 'secret',
      review,
      context: { team: 'checkout' },
      appVersion: '1.2.3',
    });
    recorder.tag('plan', 'pro');
    recorder.measure('items', 3);
    recorder.tag('bad key!');

    const options = review.mount.mock.calls[0][0];
    expect(options.context).toMatchObject({ team: 'checkout', _app_version: '1.2.3', userAgent: { browser: 'test' } });
    expect(options.context._csr_sdk_version).toEqual(expect.any(String));
    expect(review.addEvent.mock.calls.map(([event]) => event.data)).toEqual([
      { plugin: 'csr:tag', payload: { key: 'plan', value: 'pro' } },
      { plugin: 'csr:measure', payload: { key: 'items', value: 3 } },
    ]);
    expect(createUploader).not.toHaveBeenCalled();
  });

  it('replays evaluated flags into each review recording', () => {
    vi.stubGlobal('document', { body: {} });
    vi.stubGlobal('window', {
      __confidence: { flags: { 'new-checkout': { variant: 'on', assignmentOrigin: 'targeting' } } },
    });
    const review = reviewModule();

    initSessionRecorder({ clientSecret: 'secret', review });
    expect(review.addEvent).not.toHaveBeenCalled();
    review.mount.mock.calls[0][0].onRecordingStart();

    expect(review.addEvent.mock.calls.map(([event]) => event.data)).toEqual([
      {
        plugin: 'csr:flagEvaluation',
        payload: { flagKey: 'new-checkout', variant: 'on', assignmentOrigin: 'targeting' },
      },
    ]);
  });

  it('adds set flags to the review and replays them into each review recording', () => {
    vi.stubGlobal('document', { body: {} });
    const review = reviewModule();

    const recorder = initSessionRecorder({ clientSecret: 'secret', review });
    recorder.setFlags({ checkout: { variant: 'treatment', assignmentOrigin: 'rule' } });
    review.mount.mock.calls[0][0].onRecordingStart();

    const flagEvent = {
      plugin: 'csr:flagEvaluation',
      payload: { flagKey: 'flags/checkout', variant: 'flags/checkout/variants/treatment', assignmentOrigin: 'rule' },
    };
    expect(review.addEvent.mock.calls.map(([event]) => event.data)).toEqual([flagEvent, flagEvent]);
  });

  it('waits for the body before mounting', () => {
    let onReady: (() => void) | undefined;
    vi.stubGlobal('document', {
      body: null,
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'DOMContentLoaded') onReady = listener;
      },
    });
    const review = reviewModule();

    initSessionRecorder({ clientSecret: 'secret', review });
    expect(review.mount).not.toHaveBeenCalled();
    onReady!();
    expect(review.mount).toHaveBeenCalledOnce();
  });

  it('ignores mode and says so', async () => {
    vi.stubGlobal('document', { body: {} });
    const debugLogger = vi.fn();

    initSessionRecorder({ clientSecret: 'secret', review: reviewModule(), mode: 'automatic', debugLogger });
    await flushPromises();

    expect(createUploader).not.toHaveBeenCalled();
    expect(debugLogger).toHaveBeenCalledWith("[CSR] review is set, so mode 'automatic' is ignored");
  });

  it('does nothing outside a browser', () => {
    const review = reviewModule();
    initSessionRecorder({ clientSecret: 'secret', review });
    expect(review.mount).not.toHaveBeenCalled();
    expect(createUploader).not.toHaveBeenCalled();
  });
});
