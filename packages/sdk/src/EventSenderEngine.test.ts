import { EventSenderEngine } from './EventSenderEngine';

jest.useFakeTimers();

const BATCH_SIZE = 10;
const MAX_OPEN_REQUESTS = 10;
const UPLOAD_LATENCY = 10;
const FLUSH_TIMEOUT = 10;

describe('EventSenderEngine unit tests', () => {
  const mockFetch = jest.fn(async () => {
    await sleep(UPLOAD_LATENCY);
    return new Response(JSON.stringify({ errors: [] }));
  });
  const engine = new EventSenderEngine({
    clientSecret: 'some client secret',
    maxBatchSize: BATCH_SIZE,
    flushTimeoutMilliseconds: FLUSH_TIMEOUT,
    fetchImplementation: mockFetch as any,
    region: 'eu',
    maxOpenRequests: MAX_OPEN_REQUESTS,
    logger: {},
  });
  const flushSpy = jest.spyOn(engine, 'flush');
  it(`should flush ${FLUSH_TIMEOUT} millisecond after the last send`, async () => {
    engine.send({}, 'some-event');
    await jest.advanceTimersByTimeAsync(FLUSH_TIMEOUT - 1);
    expect(flushSpy).toHaveBeenCalledTimes(0);

    engine.send({}, 'some-event');
    await jest.advanceTimersByTimeAsync(FLUSH_TIMEOUT - 1);
    expect(flushSpy).toHaveBeenCalledTimes(0);

    await jest.advanceTimersByTimeAsync(1);
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
  it('should flush once batch is full', async () => {
    for (let i = 0; i <= BATCH_SIZE; i++) {
      engine.send({ i: 'pants' }, 'event', { message: '' });
    }
    expect(flushSpy).toHaveBeenCalledTimes(1);
    await jest.runAllTimersAsync();
  });
  it('payload should prioritize message fields', async () => {
    const noBatchEngine = new EventSenderEngine({
      clientSecret: 'my_secret',
      maxBatchSize: 1,
      flushTimeoutMilliseconds: FLUSH_TIMEOUT,
      fetchImplementation: mockFetch as any,
      region: 'eu',
      maxOpenRequests: MAX_OPEN_REQUESTS,
      logger: {},
    });
    const uploadSpy = jest.spyOn(noBatchEngine, 'upload');
    noBatchEngine.send({ a: 2, message: 3 }, 'my_event', { a: 0, message: 1 });
    await jest.runAllTimersAsync();
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith({
      sendTime: expect.any(String),
      clientSecret: 'my_secret',
      events: [
        {
          eventDefinition: 'my_event',
          eventTime: expect.any(String),
          payload: {
            a: 0,
            message: 1,
          },
        },
      ],
    });
  });
  it('should handle a lot of events', async () => {
    const eventCount = BATCH_SIZE * MAX_OPEN_REQUESTS * 2;
    for (let i = 0; i < eventCount; i++) {
      engine.send({ i: 'pants' }, 'event', { message: '' });
    }
    await jest.runAllTimersAsync();
    expect(flushSpy).toHaveBeenCalledTimes(eventCount / BATCH_SIZE);
    expect(mockFetch).toHaveBeenCalledTimes(MAX_OPEN_REQUESTS);
    const flushResults = await Promise.all(flushSpy.mock.results.map(x => x.value));
    expect(flushResults.slice(0, MAX_OPEN_REQUESTS).every(x => x)).toBe(true);
    expect(flushResults.slice(MAX_OPEN_REQUESTS).every(x => !x)).toBe(true);
  });
});

function sleep(millis: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, millis);
  });
}
