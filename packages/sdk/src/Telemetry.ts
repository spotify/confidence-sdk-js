import {
  LibraryTraces,
  LibraryTraces_Library,
  LibraryTraces_Trace,
  LibraryTraces_TraceId,
  Monitoring,
  Platform,
} from './generated/confidence/telemetry/v1/telemetry';
import { Logger } from './logger';

// ~250 bytes per trace in JSON. 0.75 * 64KB keepalive limit ≈ 48KB → ~190 traces.
export const MAX_TRACE_COUNT = 190;

export type TelemetryOptions = {
  disabled: boolean;
  logger?: Logger;
  environment: 'backend' | 'client';
  library?: LibraryTraces_Library;
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
  private traceCount = 0;
  onFlush?: () => void;

  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
    this.logger = opts.logger;
    this.platform = opts.environment === 'client' ? Platform.PLATFORM_JS_WEB : Platform.PLATFORM_JS_SERVER;
    this.library = opts.library ?? LibraryTraces_Library.LIBRARY_CONFIDENCE;
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
      traces.push({
        id,
        ...data,
      });
      this.traceCount++;
      if (this.traceCount >= MAX_TRACE_COUNT) {
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
    this.traceCount = 0;
    return { libraryTraces, platform: this.platform };
  }
}
