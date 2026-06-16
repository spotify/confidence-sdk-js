// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingEvent, RecordingEventType, type RouteChangePluginData } from '@spotify-confidence/csr-common';
import { Recorder } from './recorder';
import { RecordingEngine } from './engine';

class MockEngine implements RecordingEngine {
  private onEvent: ((event: RecordingEvent) => void) | null = null;
  startCalled = false;
  stopCalled = false;
  /** Events emitted synchronously during start(), simulating rrweb behaviour. */
  eventsOnStart: RecordingEvent[] = [];

  start(_config: unknown, onEvent: (event: RecordingEvent) => void): void {
    this.startCalled = true;
    this.onEvent = onEvent;
    for (const event of this.eventsOnStart) {
      onEvent(event);
    }
  }

  stop(): void {
    this.stopCalled = true;
    this.onEvent = null;
  }

  emit(event: RecordingEvent): void {
    this.onEvent?.(event);
  }
}

function routeChangeEvents(onEvent: ReturnType<typeof vi.fn>) {
  return (onEvent.mock.calls as [RecordingEvent][])
    .map(([e]) => e)
    .filter(e => e.type === RecordingEventType.Plugin && (e.data as RouteChangePluginData).plugin === 'csr:routeChange')
    .map(e => (e.data as RouteChangePluginData).payload);
}

describe('Recorder route change capture', () => {
  let originalPushState: typeof history.pushState;
  let originalReplaceState: typeof history.replaceState;

  beforeEach(() => {
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;
  });

  afterEach(() => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  it('patches history by default', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    expect(history.pushState).not.toBe(originalPushState);
    recorder.stop();
  });

  it('does not patch history when captureRouteChanges is false', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start({ captureRouteChanges: false });
    expect(history.pushState).toBe(originalPushState);
    recorder.stop();
  });

  it('restores history on stop', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    recorder.stop();
    expect(history.pushState).toBe(originalPushState);
    expect(history.replaceState).toBe(originalReplaceState);
  });

  it('emits a Plugin event for pushState', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.pushState({}, '', '/new-page');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/new-page');
    expect(events[0].trigger).toBe('pushState');

    recorder.stop();
  });

  it('emits a Plugin event for replaceState', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.replaceState({}, '', '/replaced');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/replaced');
    expect(events[0].trigger).toBe('replaceState');

    recorder.stop();
  });

  it('does not emit when URL is unchanged', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    const currentPath = window.location.pathname;
    history.replaceState({}, '', currentPath);

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(0);

    recorder.stop();
  });

  it('does not emit when parameterized routes are identical', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.pushState({}, '', '/users/123');
    history.pushState({}, '', '/users/456');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/users/:id');

    recorder.stop();
  });

  it('emits for popstate events', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.pushState({}, '', '/page-a');
    history.pushState({}, '', '/page-b');

    const prePopEvents = routeChangeEvents(onEvent);
    expect(prePopEvents).toHaveLength(2);

    history.back();
    // happy-dom fires popstate synchronously on history.back()
    window.dispatchEvent(new PopStateEvent('popstate'));

    const allEvents = routeChangeEvents(onEvent);
    const popstateEvents = allEvents.filter(e => e.trigger === 'popstate');
    expect(popstateEvents.length).toBeGreaterThanOrEqual(1);

    recorder.stop();
  });

  it('parameterizes routes by default', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.pushState({}, '', '/users/123');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/users/:id');

    recorder.stop();
  });

  it('parameterizes UUIDs by default', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    history.pushState({}, '', '/items/550e8400-e29b-41d4-a716-446655440000');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/items/:uuid');

    recorder.stop();
  });

  it('uses a custom parameterizeRoute when provided', () => {
    const engine = new MockEngine();
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({
      parameterizeRoute: route => route.replace(/\/users\/[^/]+/, '/users/:userId'),
    });

    history.pushState({}, '', '/users/alice');

    const events = routeChangeEvents(onEvent);
    expect(events).toHaveLength(1);
    expect(events[0].to).toBe('/users/:userId');

    recorder.stop();
  });

  it('parameterizes href in meta events emitted by the engine', () => {
    const engine = new MockEngine();
    engine.eventsOnStart = [
      {
        type: RecordingEventType.Meta,
        timestamp: 1,
        data: { href: 'https://example.com/users/123/settings', width: 1920, height: 1080 },
      },
    ];
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start();

    const metaEvents = (onEvent.mock.calls as [RecordingEvent][])
      .map(([e]) => e)
      .filter(e => e.type === RecordingEventType.Meta);

    expect(metaEvents).toHaveLength(1);
    expect((metaEvents[0].data as { href: string }).href).toBe('https://example.com/users/:id/settings');

    recorder.stop();
  });

  it('parameterizes meta href using custom parameterizeRoute', () => {
    const engine = new MockEngine();
    engine.eventsOnStart = [
      {
        type: RecordingEventType.Meta,
        timestamp: 1,
        data: { href: 'https://example.com/teams/acme-corp/dashboard', width: 1920, height: 1080 },
      },
    ];
    const onEvent = vi.fn();
    const recorder = new Recorder({ engine, onEvent });
    recorder.start({
      parameterizeRoute: route => route.replace(/\/teams\/[^/]+/, '/teams/:slug'),
    });

    const metaEvents = (onEvent.mock.calls as [RecordingEvent][])
      .map(([e]) => e)
      .filter(e => e.type === RecordingEventType.Meta);

    expect(metaEvents).toHaveLength(1);
    expect((metaEvents[0].data as { href: string }).href).toBe('https://example.com/teams/:slug/dashboard');

    recorder.stop();
  });

  it('removes popstate listener on stop', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();

    const popstateAdds = addSpy.mock.calls.filter(([t]) => t === 'popstate');
    expect(popstateAdds.length).toBe(1);

    recorder.stop();

    const popstateRemoves = removeSpy.mock.calls.filter(([t]) => t === 'popstate');
    expect(popstateRemoves.length).toBe(1);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
