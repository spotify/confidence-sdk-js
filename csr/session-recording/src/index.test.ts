import { afterEach, describe, expect, it, vi } from 'vitest';

const createUploader = vi.hoisted(() => vi.fn());
const record = vi.hoisted(() => vi.fn());

vi.mock('@spotify-confidence/csr-common/uploader', () => ({
  createUploader,
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

  it('forwards options to createUploader and record', async () => {
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
});
