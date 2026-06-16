export { Recorder } from './recorder';
export { type RecordingEngine } from './engine';
export { RrwebEngine } from './engine/rrweb-engine';
export {
  type RecorderOptions,
  type RecordingConfig,
  RecorderState,
  DEFAULT_MASK_SELECTORS,
  DEFAULT_BLOCK_SELECTORS,
} from './types';
export { record } from './start-recording';
export { defaultParameterizeRoute } from './route-parameterizer';
