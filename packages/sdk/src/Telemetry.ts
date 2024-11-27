import {
  LibraryTraces_Library,
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

export class Telemetry {
  private disabled: boolean;
  private logger: Logger;
  constructor(opts: TelemetryOptions) {
    this.disabled = opts.disabled;
    this.logger = opts.logger;
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
      this.logger.warn?.(`pushTrace() got called before registering tag (${library}, ${version})`);
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
      // only clear traces. keep library and version since tags are registered on this.
      trace.traces = [];
    });
    return snapshot;
  }
}
