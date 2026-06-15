import { RecordingEvent } from '@spotify-confidence/csr-common';
import { Recorder } from './recorder';
import { RrwebEngine } from './engine/rrweb-engine';
import { RecordingConfig } from './types';

/**
 * Start recording DOM events. Each event is passed to the callback
 * as it is captured — no buffering or batching.
 *
 * Returns a function that stops the recording.
 */
export function record(onEvent: (event: RecordingEvent) => void, config?: RecordingConfig): () => void {
  const recorder = new Recorder({
    engine: new RrwebEngine(),
    onEvent,
  });

  recorder.start(config);

  return () => recorder.stop();
}
