import {
  LibraryTraces,
  LibraryTraces_Library,
  LibraryTraces_Trace,
  LibraryTraces_TraceId,
  Monitoring,
} from './generated/confidence/telemetry/v1/telemetry';
import { Logger } from './logger';

export type TelemetryOptions = { disabled: boolean; logger: Logger };

export type Tag = {
  library: LibraryTraces_Library;
  version: string;
  id: LibraryTraces_TraceId;
};

export type Counter = () => void;
export type Meter = (value: number) => void;
export type TraceConsumer = (trace: Omit<LibraryTraces_Trace, 'id'>) => void;
export class Telemetry {
  private readonly disabled: boolean;
  private readonly logger: Logger;
  private readonly libraryTraces: LibraryTraces[] = [];

  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
    this.logger = opts.logger;
  }

  private registerLibraryTraces({ library, version, id }: Tag): TraceConsumer {
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
      this.logger.trace?.(LibraryTraces_TraceId[id], data);
      traces.push({
        id,
        ...data,
      });
    };
  }

  registerCounter(tag: Tag): Counter {
    const traceConsumer = this.registerLibraryTraces(tag);
    return () => traceConsumer({});
  }

  registerMeter(tag: Tag): Meter {
    const traceConsumer = this.registerLibraryTraces(tag);
    return (millisecondDuration: number) => traceConsumer({ millisecondDuration });
  }

  getSnapshot(): Monitoring {
    const libraryTraces = this.libraryTraces
      .filter(({ traces }) => traces.length > 0)
      .map(({ library, libraryVersion, traces }) => ({
        library,
        libraryVersion,
        traces: traces.splice(0, traces.length),
      }));
    return { libraryTraces };
  }
}
