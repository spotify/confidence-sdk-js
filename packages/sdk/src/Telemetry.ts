import {
  LibraryTraces_Library,
  LibraryTraces_TraceId,
  Monitoring,
} from './generated/confidence/telemetry/v1/telemetry';

class Telemetry {
  private static instance: Telemetry;
  private monitoring: Monitoring = {
    libraryTraces: [],
  };

  static getInstance(): Telemetry {
    if (!Telemetry.instance) {
      Telemetry.instance = new Telemetry();
    }
    return Telemetry.instance;
  }

  markStaleFlag(): void {
    this.pushTrace(LibraryTraces_TraceId.TRACE_ID_STALE_FLAG);
  }

  pushTrace(traceId: LibraryTraces_TraceId, latency: number | undefined = undefined): void {
    const { library, version } = this.getLibraryAndVersion();
    const existing = this.monitoring.libraryTraces.find(trace => {
      return trace.library === library && trace.libraryVersion === version;
    });
    if (existing) {
      existing.traces.push({
        id: traceId,
        millisecondDuration: latency,
      });
    } else {
      this.monitoring.libraryTraces.push({
        library,
        libraryVersion: version,
        traces: [
          {
            id: traceId,
            millisecondDuration: latency,
          },
        ],
      });
    }
  }

  getLibraryAndVersion(): { library: LibraryTraces_Library; version: string } {
    // TODO - get the library and version somehow
    return {
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '0.0.0',
    };
  }

  markFlagResolved(latency: number): void {
    this.pushTrace(LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, latency);
  }

  getSnapshot(): Monitoring {
    const snapshot = { ...this.monitoring };
    this.monitoring = { libraryTraces: [] }; // Reset the state
    return snapshot;
  }
}

export default Telemetry;
