import {
  LibraryTraces_Library,
  LibraryTraces_TraceId,
  Monitoring,
} from './generated/confidence/telemetry/v1/telemetry';

export type TelemetryOptions = { disabled: boolean };

export type Tag = {
  library: LibraryTraces_Library;
  version: string;
  id: LibraryTraces_TraceId;
};

export type Counter = () => void;
export type Meter = (value: number) => void;

export class Telemetry {
  private disabled: boolean;
  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
  }

  private monitoring: Monitoring = {
    libraryTraces: [],
  };

  private pushTrace(tags: Tag, value: number | undefined = undefined): void {
    const library = tags.library;
    const version = tags.version;
    const existing = this.monitoring.libraryTraces.find(trace => {
      return trace.library === library && trace.libraryVersion === version;
    });
    if (existing) {
      existing.traces.push({
        id: tags.id,
        millisecondDuration: value,
      });
    } else {
      // should never happen. remove?
      this.monitoring.libraryTraces.push({
        library,
        libraryVersion: version,
        traces: [
          {
            id: tags.id,
            millisecondDuration: value,
          },
        ],
      });
    }
  }

  registerCounter(tag: Tag): Counter {
    this.monitoring.libraryTraces.push({
      library: tag.library,
      libraryVersion: tag.version,
      traces: [],
    });
    return () => {
      this.pushTrace(tag);
    };
  }

  registerMeter(tag: Tag): Meter {
    this.monitoring.libraryTraces.push({
      library: tag.library,
      libraryVersion: tag.version,
      traces: [],
    });
    return (value: number) => {
      this.pushTrace(tag, value);
    };
  }

  getSnapshot(): Monitoring | undefined {
    if (this.disabled) {
      return undefined;
    }
    // retrieve a snapshot with all monitoring data but deep copied
    const snapshot = structuredClone(this.monitoring);
    this.monitoring.libraryTraces.forEach(trace => {
      // only clear traces. keep library and version since they are registered.
      trace.traces = [];
    });
    return snapshot;
  }
}
