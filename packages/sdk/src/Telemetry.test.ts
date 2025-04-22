import { LibraryTraces_Library, LibraryTraces_TraceId, LibraryTraces_Trace_RequestTrace_Status } from './generated/confidence/telemetry/v1/telemetry';
import { Telemetry } from './Telemetry';

describe('Telemetry', () => {
  it('registerLibraryTraces and increment counter', () => {
    const telemetry = new Telemetry({ disabled: false, environment: 'backend' });
    const traceConsumer = telemetry.registerLibraryTraces({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    // increment the registered counter 3 times
    traceConsumer({});
    traceConsumer({});
    traceConsumer({});
    const snapshot = telemetry.getSnapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot?.libraryTraces.length).toEqual(1);
    expect(snapshot?.libraryTraces[0].library).toEqual(LibraryTraces_Library.LIBRARY_CONFIDENCE);
    expect(snapshot?.libraryTraces[0].libraryVersion).toEqual('9.9.9');
    expect(snapshot?.libraryTraces[0].traces).toEqual([
      { id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG },
      { id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG },
      { id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG },
    ]);
  });

  it('registerLibraryTraces and add measurement', () => {
    const telemetry = new Telemetry({ disabled: false, environment: 'client' });
    const traceConsumer = telemetry.registerLibraryTraces({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY,
    });
    // measure 3 times with different values
    traceConsumer({ requestTrace: { millisecondDuration: 10, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS } });
    traceConsumer({ requestTrace: { millisecondDuration: 20, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS } });
    traceConsumer({ requestTrace: { millisecondDuration: 30, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_ERROR } });
    const snapshot = telemetry.getSnapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot?.libraryTraces.length).toEqual(1);
    expect(snapshot?.libraryTraces[0].library).toEqual(LibraryTraces_Library.LIBRARY_CONFIDENCE);
    expect(snapshot?.libraryTraces[0].libraryVersion).toEqual('9.9.9');
    expect(snapshot?.libraryTraces[0].traces).toEqual([
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, requestTrace: { millisecondDuration: 10, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS } },
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, requestTrace: { millisecondDuration: 20, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS } },
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, requestTrace: { millisecondDuration: 30, status: LibraryTraces_Trace_RequestTrace_Status.STATUS_ERROR } },
    ]);
  });

  it('snapshot is empty when telemetry is disabled', () => {
    const telemetry = new Telemetry({ disabled: true, environment: 'client' });
    const traceConsumer = telemetry.registerLibraryTraces({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    traceConsumer({});
    const snapshot = telemetry.getSnapshot();
    expect(snapshot.libraryTraces.length).toBe(0);
  });

  it('monitoring gets cleared after snapshot is obtained', () => {
    const telemetry = new Telemetry({ disabled: false, environment: 'client' });
    const traceConsumer = telemetry.registerLibraryTraces({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    traceConsumer({});
    const snapshotFirst = telemetry.getSnapshot();
    expect(snapshotFirst).toBeTruthy();
    expect(snapshotFirst?.libraryTraces.length).toEqual(1);
    expect(snapshotFirst?.libraryTraces[0].traces).toEqual([{ id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG }]);
    const snapshotSecond = telemetry.getSnapshot();
    // the counter is still registered but the traces are cleared
    expect(snapshotSecond?.libraryTraces.length).toBe(0);
  });
});
