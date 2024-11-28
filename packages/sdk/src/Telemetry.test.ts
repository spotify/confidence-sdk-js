import { LibraryTraces_Library, LibraryTraces_TraceId } from './generated/confidence/telemetry/v1/telemetry';
import { Telemetry } from './Telemetry';

describe('Telemetry', () => {
  it('registerCounter and increment counter', () => {
    const telemetry = new Telemetry({ disabled: false, logger: { warn: jest.fn() } });
    const counter = telemetry.registerCounter({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    // increment the registered counter 3 times
    counter();
    counter();
    counter();
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

  it('registerMeter and add measurement', () => {
    const telemetry = new Telemetry({ disabled: false, logger: { warn: jest.fn() } });
    const meter = telemetry.registerMeter({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY,
    });
    // measure 3 times with different values
    meter(10);
    meter(20);
    meter(30);
    const snapshot = telemetry.getSnapshot();
    expect(snapshot).toBeTruthy();
    expect(snapshot?.libraryTraces.length).toEqual(1);
    expect(snapshot?.libraryTraces[0].library).toEqual(LibraryTraces_Library.LIBRARY_CONFIDENCE);
    expect(snapshot?.libraryTraces[0].libraryVersion).toEqual('9.9.9');
    expect(snapshot?.libraryTraces[0].traces).toEqual([
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, millisecondDuration: 10 },
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, millisecondDuration: 20 },
      { id: LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY, millisecondDuration: 30 },
    ]);
  });

  it('snapshot is empty when telemetry is disabled', () => {
    const telemetry = new Telemetry({ disabled: true, logger: { warn: jest.fn() } });
    const counter = telemetry.registerCounter({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    counter();
    const snapshot = telemetry.getSnapshot();
    expect(snapshot.libraryTraces.length).toBe(0);
  });

  it('monitoring gets cleared after snapshot is obtained', () => {
    const telemetry = new Telemetry({ disabled: false, logger: { warn: jest.fn() } });
    const counter = telemetry.registerCounter({
      library: LibraryTraces_Library.LIBRARY_CONFIDENCE,
      version: '9.9.9',
      id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG,
    });
    counter();
    const snapshotFirst = telemetry.getSnapshot();
    expect(snapshotFirst).toBeTruthy();
    expect(snapshotFirst?.libraryTraces.length).toEqual(1);
    expect(snapshotFirst?.libraryTraces[0].traces).toEqual([{ id: LibraryTraces_TraceId.TRACE_ID_STALE_FLAG }]);
    const snapshotSecond = telemetry.getSnapshot();
    // the counter is still registered but the traces are cleared
    expect(snapshotSecond?.libraryTraces.length).toBe(0);
  });
});
