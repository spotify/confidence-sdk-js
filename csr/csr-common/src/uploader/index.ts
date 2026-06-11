export { createUploader } from './create-uploader';
export { type Uploader, type CreateUploaderOptions } from './types';
export {
  collectUserAgentContext,
  type ClientContext,
  type UserAgentContext,
  type ContextValue,
} from './client-context';

/**
 * Bundled worker source. Re-exported so consumers can serve it at a stable same-origin
 * URL and pass that URL via `createUploader({ workerUrl })` — required for cross-tab
 * SharedWorker sharing (per-document blob URLs defeat sharing).
 */
export { workerScript } from './worker/worker-script';
