import {
  LibraryTraces,
  LibraryTraces_Library,
  LibraryTraces_Trace,
  LibraryTraces_TraceId,
  Monitoring,
  Platform,
} from './generated/confidence/telemetry/v1/telemetry';
import { Logger } from './logger';

// 0.75 * 64KB keepalive limit = 48KB
const DEFAULT_MAX_BUFFER_BYTES = 0.75 * 64 * 1024;

export type TelemetryOptions = {
  disabled: boolean;
  logger?: Logger;
  environment: 'backend' | 'client';
  library?: LibraryTraces_Library;
  maxBufferBytes?: number;
};

export type Tag = {
  library: LibraryTraces_Library;
  version: string;
  id: LibraryTraces_TraceId;
};

export type TraceConsumer = (trace: Omit<LibraryTraces_Trace, 'id'>) => void;
export class Telemetry {
  private readonly disabled: boolean;
  private readonly logger?: Logger;
  private readonly libraryTraces: LibraryTraces[] = [];
  private readonly platform: Platform;
  private readonly library: LibraryTraces_Library;
  private readonly maxBufferBytes: number;
  private bufferBytes = 0;
  onFlush?: () => void;

  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
    this.logger = opts.logger;
    this.platform = opts.environment === 'client' ? Platform.PLATFORM_JS_WEB : Platform.PLATFORM_JS_SERVER;
    this.library = opts.library ?? LibraryTraces_Library.LIBRARY_CONFIDENCE;
    this.maxBufferBytes = opts.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  }

  public registerLibraryTraces({ library, version, id }: Tag): TraceConsumer {
    if (this.disabled) {
      return () => {};
    }
    const traces: LibraryTraces_Trace[] = [];
    this.libraryTraces.push({
      library: library,
      libraryVersion: version,
      traces,
    });
    return data => {
      this.logger?.debug?.(LibraryTraces_TraceId[id], data);
      const trace: LibraryTraces_Trace = { id, ...data };
      traces.push(trace);
      this.bufferBytes += LibraryTraces_Trace.encode(trace).finish().byteLength;
      if (this.bufferBytes >= this.maxBufferBytes) {
        this.onFlush?.();
      }
    };
  }

  getSnapshot(): Monitoring {
    const currentLibrary = this.library;
    const libraryTraces = this.libraryTraces
      .filter(({ traces }) => traces.length > 0)
      .map(({ libraryVersion, traces }) => ({
        library: currentLibrary,
        libraryVersion,
        traces: traces.splice(0, traces.length),
      }));
    this.bufferBytes = 0;
    return { libraryTraces, platform: this.platform };
  }
}
