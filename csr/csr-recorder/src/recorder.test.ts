import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecordingEvent, RecordingEventType, type NetworkRequestPluginData } from '@spotify-confidence/csr-common';
import { Recorder } from './recorder';
import { RecordingEngine } from './engine';
import { RecorderState } from './types';

function makeEvent(timestamp: number): RecordingEvent {
  return { type: RecordingEventType.Meta, timestamp, data: {} };
}

class MockEngine implements RecordingEngine {
  private onEvent: ((event: RecordingEvent) => void) | null = null;
  startCalled = false;
  stopCalled = false;

  start(_config: unknown, onEvent: (event: RecordingEvent) => void): void {
    this.startCalled = true;
    this.onEvent = onEvent;
  }

  stop(): void {
    this.stopCalled = true;
    this.onEvent = null;
  }

  emit(event: RecordingEvent): void {
    this.onEvent?.(event);
  }
}

describe('Recorder', () => {
  it('starts in Idle state', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    expect(recorder.currentState).toBe(RecorderState.Idle);
  });

  it('transitions to Recording on start', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    expect(recorder.currentState).toBe(RecorderState.Recording);
    expect(engine.startCalled).toBe(true);
  });

  it('transitions to Stopped on stop', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    recorder.stop();
    expect(recorder.currentState).toBe(RecorderState.Stopped);
    expect(engine.stopCalled).toBe(true);
  });

  it('ignores duplicate start calls', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    recorder.start();
    expect(recorder.currentState).toBe(RecorderState.Recording);
  });

  it('ignores stop when not recording', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.stop();
    expect(recorder.currentState).toBe(RecorderState.Idle);
    expect(engine.stopCalled).toBe(false);
  });

  it('passes each event to the onEvent callback', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    engine.emit(makeEvent(1));
    engine.emit(makeEvent(2));

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, makeEvent(1));
    expect(onEvent).toHaveBeenNthCalledWith(2, makeEvent(2));
  });
});

describe('Recorder network request capture', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not patch fetch by default', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    expect(globalThis.fetch).toBe(originalFetch);
    recorder.stop();
  });

  it('patches fetch when captureNetworkRequests is true', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start({ captureNetworkRequests: true });
    expect(globalThis.fetch).not.toBe(originalFetch);
    recorder.stop();
  });

  it('restores fetch on stop', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start({ captureNetworkRequests: true });
    recorder.stop();
    expect(globalThis.fetch).toBe(originalFetch);
  });

  it('emits a Plugin event for a successful fetch', async () => {
    const mockResponse = new Response('ok', {
      status: 200,
      headers: { 'content-length': '2' },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/data');

    const pluginEvents = onEvent.mock.calls
      .map(([e]: [RecordingEvent]) => e)
      .filter(e => e.type === RecordingEventType.Plugin);
    expect(pluginEvents).toHaveLength(1);
    const data = pluginEvents[0].data as NetworkRequestPluginData;
    expect(data.plugin).toBe('csr:networkRequest');
    expect(data.payload.initiator).toBe('fetch');
    expect(data.payload.method).toBe('GET');
    expect(data.payload.url).toBe('https://api.example.com/data');
    expect(data.payload.status).toBe(200);
    expect(data.payload.responseSize).toBe(2);
    expect(data.payload.durationMs).toBeGreaterThanOrEqual(0);

    recorder.stop();
  });

  it('emits status 0 for a failed fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/data').catch(() => {});

    const pluginEvents = onEvent.mock.calls
      .map(([e]: [RecordingEvent]) => e)
      .filter(e => e.type === RecordingEventType.Plugin);
    expect(pluginEvents).toHaveLength(1);
    const data = pluginEvents[0].data as NetworkRequestPluginData;
    expect(data.payload.status).toBe(0);

    recorder.stop();
  });

  it('captures the method from init', async () => {
    const mockResponse = new Response('', { status: 201 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/data', { method: 'post' });

    const pluginEvents = onEvent.mock.calls
      .map(([e]: [RecordingEvent]) => e)
      .filter(e => e.type === RecordingEventType.Plugin);
    const data = pluginEvents[0].data as NetworkRequestPluginData;
    expect(data.payload.method).toBe('POST');

    recorder.stop();
  });

  it('captures the method from a Request object', async () => {
    const mockResponse = new Response('', { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch(new Request('https://api.example.com/data', { method: 'DELETE' }));

    const pluginEvents = onEvent.mock.calls
      .map(([e]: [RecordingEvent]) => e)
      .filter(e => e.type === RecordingEventType.Plugin);
    const data = pluginEvents[0].data as NetworkRequestPluginData;
    expect(data.payload.method).toBe('DELETE');
    expect(data.payload.url).toBe('https://api.example.com/data');

    recorder.stop();
  });
});
