// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { RecordingEvent } from '@spotify-confidence/csr-common';
import type { RecordingEngine } from './engine';
import { Recorder } from './recorder';

class MockEngine implements RecordingEngine {
  takeFullSnapshot = vi.fn();

  start(_config: unknown, _onEvent: (event: RecordingEvent) => void): void {}

  stop(): void {}
}

function dispatchPageShow(persisted: boolean): void {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}

describe('Recorder BFCache restoration', () => {
  it('takes a full snapshot when the page is restored from BFCache', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();

    dispatchPageShow(true);

    expect(engine.takeFullSnapshot).toHaveBeenCalledOnce();
    recorder.stop();
  });

  it('does not take another snapshot for a normal pageshow event', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();

    dispatchPageShow(false);

    expect(engine.takeFullSnapshot).not.toHaveBeenCalled();
    recorder.stop();
  });

  it('stops responding to pageshow events after recording stops', () => {
    const engine = new MockEngine();
    const recorder = new Recorder({ engine, onEvent: vi.fn() });
    recorder.start();
    recorder.stop();

    dispatchPageShow(true);

    expect(engine.takeFullSnapshot).not.toHaveBeenCalled();
  });
});
