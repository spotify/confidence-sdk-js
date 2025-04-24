import {
  LibraryTraces,
  LibraryTraces_Library,
  LibraryTraces_Trace,
  LibraryTraces_TraceId,
  LibraryTraces_Trace_RequestTrace_Status,
  Monitoring,
  Platform,
} from './generated/confidence/telemetry/v1/telemetry';
import { Logger } from './logger';

export type TelemetryOptions = { disabled: boolean; logger?: Logger; environment: 'backend' | 'client' };

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

  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
    this.logger = opts.logger;
    this.platform = opts.environment === 'client' ? Platform.PLATFORM_JS_WEB : Platform.PLATFORM_JS_SERVER;
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
    };
  }

  getSnapshot(): Monitoring {
    const libraryTraces = this.libraryTraces
      .filter(({ traces }) => traces.length > 0)
      .map(({ library, libraryVersion, traces }) => ({
        library,
        libraryVersion,
        traces: traces.splice(0, traces.length),
      }));
    console.log('fdema: Number of library traces:', libraryTraces.length);
    console.log('fdema', libraryTraces.map(lt => 
      lt.traces.map(t => 
        `Trace ${LibraryTraces_TraceId[t.id]}: ${t.requestTrace?.millisecondDuration}ms, Status: ${t.requestTrace ? LibraryTraces_Trace_RequestTrace_Status[t.requestTrace.status] : 'N/A'}`
      ).join(' - ')
    ).join(' - '));
    return { libraryTraces, platform: this.platform };
  }
}
