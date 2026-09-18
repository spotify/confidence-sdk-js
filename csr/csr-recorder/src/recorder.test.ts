import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecordingEvent, RecordingEventType, RecordingPluginName } from '@spotify-confidence/csr-common';
import { Recorder } from './recorder';
import { RecordingEngine } from './engine';
import { RecorderState } from './types';

const networkRequestEvents = (onEvent: ReturnType<typeof vi.fn>) =>
  onEvent.mock.calls.flatMap(([event]: [RecordingEvent]) =>
    event.type === RecordingEventType.Plugin && event.data.plugin === RecordingPluginName.NetworkRequest
      ? [event.data]
      : [],
  );

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

  takeFullSnapshot(): void {}

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
    vi.unstubAllGlobals();
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

    const events = networkRequestEvents(onEvent);
    expect(events).toHaveLength(1);
    const data = events[0];
    expect(data.plugin).toBe(RecordingPluginName.NetworkRequest);
    expect(data.payload.initiator).toBe('fetch');
    expect(data.payload.method).toBe('GET');
    expect(data.payload.url).toBe('https://api.example.com/data');
    expect(data.payload.status).toBe(200);
    expect(data.payload.responseSize).toBe(2);
    expect(data.payload.durationMs).toBeGreaterThanOrEqual(0);

    recorder.stop();
  });

  it('keeps raw network URLs when sanitization is not configured', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/payment?client_secret=secret#result');

    expect(networkRequestEvents(onEvent)[0].payload.url).toBe(
      'https://api.example.com/payment?client_secret=secret#result',
    );
    recorder.stop();
  });

  it('strips query strings and fragments with built-in network sanitization', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({ captureNetworkRequests: { sanitize: true } });

    await globalThis.fetch('https://api.example.com/payment?client_secret=secret#result');

    expect(networkRequestEvents(onEvent)[0].payload.url).toBe('https://api.example.com/payment');
    recorder.stop();
  });

  it('uses a custom network sanitizer', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({
      captureNetworkRequests: {
        sanitize: url => url.replace(/client_secret=[^&]+/, 'client_secret=[REDACTED]'),
      },
    });

    await globalThis.fetch('https://api.example.com/payment?client_secret=secret&expand=customer');

    expect(networkRequestEvents(onEvent)[0].payload.url).toBe(
      'https://api.example.com/payment?client_secret=[REDACTED]&expand=customer',
    );
    recorder.stop();
  });

  it('sanitizes string, URL, and Request fetch inputs', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({ captureNetworkRequests: { sanitize: true } });

    await globalThis.fetch('/relative?secret=one#hash');
    await globalThis.fetch(new URL('https://api.example.com/url?secret=two#hash'));
    await globalThis.fetch(new Request('https://api.example.com/request?secret=three#hash'));

    expect(networkRequestEvents(onEvent).map(event => event.payload.url)).toEqual([
      '/relative',
      'https://api.example.com/url',
      'https://api.example.com/request',
    ]);
    recorder.stop();
  });

  it('sanitizes XMLHttpRequest URLs without changing the request', () => {
    class FakeXMLHttpRequest {
      status = 204;
      openedUrl: string | URL | undefined;
      private loadend: (() => void) | undefined;

      open(_method: string, url: string | URL) {
        this.openedUrl = url;
      }

      send() {
        this.loadend?.call(this);
      }

      addEventListener(_type: string, listener: () => void) {
        this.loadend = listener;
      }

      getResponseHeader() {
        return null;
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({ captureNetworkRequests: { sanitize: true } });
    const xhr = new FakeXMLHttpRequest();

    xhr.open('GET', 'https://api.example.com/payment?client_secret=secret#result');
    xhr.send();

    expect(xhr.openedUrl).toBe('https://api.example.com/payment?client_secret=secret#result');
    expect(networkRequestEvents(onEvent)[0].payload).toMatchObject({
      initiator: 'xhr',
      url: 'https://api.example.com/payment',
      status: 204,
    });
    recorder.stop();
  });

  it('drops network metadata and logs when a custom sanitizer throws', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const debugLogger = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({
      captureNetworkRequests: {
        sanitize: () => {
          throw new Error('sanitizer bug');
        },
      },
      debugLogger,
    });

    await expect(globalThis.fetch('https://api.example.com/payment?client_secret=secret')).resolves.toBeInstanceOf(
      Response,
    );
    await globalThis.fetch('https://api.example.com/payment?client_secret=another-secret');

    expect(networkRequestEvents(onEvent)).toHaveLength(0);
    expect(debugLogger).toHaveBeenCalledWith(expect.stringMatching(/SECURITY.*network.*dropped/i));
    expect(debugLogger).toHaveBeenCalledTimes(1);
    expect(debugLogger.mock.calls.join(' ')).not.toContain('client_secret=secret');
    recorder.stop();
  });

  it('keeps sanitizing a request that is still in flight when the recorder stops', async () => {
    let settleFetch: (response: Response) => void = () => {};
    globalThis.fetch = vi.fn().mockReturnValue(new Promise<Response>(resolve => (settleFetch = resolve)));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({ captureNetworkRequests: { sanitize: true } });

    // `stop()` cannot cancel an in-flight request, so its patched handler still emits.
    const inFlight = globalThis.fetch('https://api.example.com/payment?client_secret=secret');
    recorder.stop();
    settleFetch(new Response('', { status: 200 }));
    await inFlight;

    expect(networkRequestEvents(onEvent)[0].payload.url).toBe('https://api.example.com/payment');
  });

  it('does not let a failing debug logger affect the application request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    const onEvent = vi.fn();
    const recorder = new Recorder({ engine: new MockEngine(), onEvent });
    recorder.start({
      captureNetworkRequests: {
        sanitize: () => {
          throw new Error('sanitizer bug');
        },
      },
      debugLogger: () => {
        throw new Error('logger bug');
      },
    });

    await expect(globalThis.fetch('https://api.example.com/payment?client_secret=secret')).resolves.toBeInstanceOf(
      Response,
    );
    expect(networkRequestEvents(onEvent)).toHaveLength(0);
    recorder.stop();
  });

  it('emits status 0 for a failed fetch', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/data').catch(() => {});

    const events = networkRequestEvents(onEvent);
    expect(events).toHaveLength(1);
    const data = events[0];
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

    const data = networkRequestEvents(onEvent)[0];
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

    const data = networkRequestEvents(onEvent)[0];
    expect(data.payload.method).toBe('DELETE');
    expect(data.payload.url).toBe('https://api.example.com/data');

    recorder.stop();
  });

  it('captures only the GraphQL operation name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));

    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({ captureNetworkRequests: true });

    await globalThis.fetch('https://api.example.com/graphql', {
      method: 'POST',
      body: JSON.stringify({
        operationName: 'GetUser',
        query: `query GetUser($id: ID!) {
          viewer { id }
          selectedUser: user(id: $id) { ...UserDetails }
        }
        fragment UserDetails on User { name email }`,
        variables: { id: 'private-user-id' },
      }),
    });

    const data = networkRequestEvents(onEvent)[0];
    expect(data.payload.graphql).toEqual({ operationName: 'GetUser' });
    expect(JSON.stringify(data.payload)).not.toContain('private-user-id');

    recorder.stop();
  });
});
