import { RecordingEvent } from '@spotify-confidence/csr-common';
import { RecordingConfig } from '../types';

/**
 * Abstraction over the underlying recording library (rrweb, custom, etc.).
 * The Recorder class depends on this interface — never on rrweb directly.
 */
export interface RecordingEngine {
  start(config: RecordingConfig, onEvent: (event: RecordingEvent) => void): void;
  stop(): void;
  /**
   * rrweb serialized-node id for a live DOM node, or -1 if the node has not
   * been serialized (not yet snapshotted, or inside a blocked subtree).
   */
  getNodeId(node: Node): number;
}
