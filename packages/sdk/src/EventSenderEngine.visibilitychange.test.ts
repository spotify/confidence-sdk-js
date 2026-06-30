/**
 * @jest-environment jsdom
 */
import { EventSenderEngine } from './EventSenderEngine';

jest.useFakeTimers();

const BATCH_SIZE = 10;
const MAX_OPEN_REQUESTS = 10;
const UPLOAD_LATENCY = 10;
const FLUSH_TIMEOUT = 10;

describe('EventSenderEngine visibilitychange', () => {
  const mockFetch = jest.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, UPLOAD_LATENCY));
    return new Response(JSON.stringify({ errors: [] }));
  });

  let mockSendBeacon: jest.Mock;

  beforeEach(() => {
    mockFetch.mockClear();
    mockSendBeacon = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: mockSendBeacon, configurable: true, writable: true });
  });

  function createEngine(overrides?: Partial<ConstructorParameters<typeof EventSenderEngine>[0]>) {
    return new EventSenderEngine({
      clientSecret: 'my_secret',
      maxBatchSize: BATCH_SIZE,
      flushTimeoutMilliseconds: FLUSH_TIMEOUT,
      fetchImplementation: mockFetch as any,
      region: 'eu',
      maxOpenRequests: MAX_OPEN_REQUESTS,
      logger: {},
      ...overrides,
    });
  }

  it('should use sendBeacon when document becomes hidden', async () => {
    const engine = createEngine();
    engine.send({ value: 1 }, 'my_event');

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    expect(mockSendBeacon).toHaveBeenCalledWith('https://events.eu.confidence.dev/v1/events:publish', expect.any(Blob));

    const blob: Blob = mockSendBeacon.mock.calls[0][1];
    expect(blob.type).toBe('application/json');
    const body = JSON.parse(
      await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      }),
    );
    expect(body.clientSecret).toBe('my_secret');
    expect(body.events).toHaveLength(1);
    expect(body.events[0].eventDefinition).toBe('eventDefinitions/my_event');
    expect(body.events[0].payload).toEqual({ context: { value: 1 } });

    await jest.runAllTimersAsync();
  });

  it('should remove events from queue after successful beacon', async () => {
    const engine = createEngine();
    engine.send({ value: 1 }, 'my_event');

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);

    // Queue should be empty — a subsequent flush should be a no-op
    const flushResult = await engine.flush();
    expect(flushResult).toBe(true); // empty queue returns true
    expect(mockFetch).not.toHaveBeenCalled();

    await jest.runAllTimersAsync();
  });

  it('should fall back to fetch when sendBeacon returns false', async () => {
    mockSendBeacon.mockReturnValue(false);
    const engine = createEngine();
    const uploadSpy = jest.spyOn(engine, 'upload');
    engine.send({ value: 1 }, 'my_event');

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    // Events should still be in the queue and flushed via fetch
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Object), { keepalive: true });

    await jest.runAllTimersAsync();
  });

  it('should fall back to fetch when sendBeacon is unavailable', async () => {
    mockSendBeacon.mockRestore();
    const original = navigator.sendBeacon;
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });

    try {
      const engine = createEngine();
      const uploadSpy = jest.spyOn(engine, 'upload');
      engine.send({ value: 1 }, 'my_event');

      jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(uploadSpy).toHaveBeenCalledWith(expect.any(Object), { keepalive: true });
    } finally {
      Object.defineProperty(navigator, 'sendBeacon', { value: original, configurable: true });
    }

    await jest.runAllTimersAsync();
  });

  it('should not use keepalive for regular flushes', async () => {
    const engine = createEngine();
    const uploadSpy = jest.spyOn(engine, 'upload');
    engine.send({ value: 1 }, 'my_event');

    await jest.advanceTimersByTimeAsync(FLUSH_TIMEOUT);

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Object), { keepalive: undefined });
    expect(mockSendBeacon).not.toHaveBeenCalled();

    await jest.runAllTimersAsync();
  });

  it('should not beacon when queue is empty', async () => {
    createEngine();

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    await jest.runAllTimersAsync();
  });

  it('should include sendTime in beaconed payload', async () => {
    const engine = createEngine();
    engine.send({ value: 1 }, 'my_event');

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    const blob: Blob = mockSendBeacon.mock.calls[0][1];
    const body = JSON.parse(
      await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      }),
    );
    expect(body.sendTime).toBeDefined();
    expect(new Date(body.sendTime).getTime()).not.toBeNaN();

    await jest.runAllTimersAsync();
  });

  it('should cap beacon batch size and leave remaining events in queue', async () => {
    const engine = createEngine({ maxBatchSize: 100 });
    // Send 40 events — more than the 25-event beacon cap but within maxBatchSize
    for (let i = 0; i < 40; i++) {
      engine.send({ value: i }, 'my_event');
    }

    engine.clearPendingFlush();

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    const blob: Blob = mockSendBeacon.mock.calls[0][1];
    const body = JSON.parse(
      await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      }),
    );
    // Only 25 events beaconed, 15 remain in queue
    expect(body.events).toHaveLength(25);

    await jest.runAllTimersAsync();
  });
});
