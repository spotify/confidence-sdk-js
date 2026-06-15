import { RecordingEvent } from '@spotify-confidence/csr-common';
import { RecordingConfig } from '../types';

/**
 * Abstraction over the underlying recording library (rrweb, custom, etc.).
 * The Recorder class depends on this interface — never on rrweb directly.
 */
export interface RecordingEngine {
  start(config: RecordingConfig, onEvent: (event: RecordingEvent) => void): void;
  stop(): void;
}
