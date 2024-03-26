import { EventSenderEngine } from './EventSenderEngine';

jest.useFakeTimers()

const BATCH_SIZE = 10;
const MAX_OPEN_REQUESTS = 10;
const UPLOAD_LATENCY = 10;
const FLUSH_TIMEOUT = 10;

describe('EventSenderEngine unit tests', () => {
  const mockFetch = jest.fn(async () => {
    await sleep(UPLOAD_LATENCY);
    return new Response(JSON.stringify({ errors: [] }))
  })
  const engine = new EventSenderEngine({
    clientSecret: 'some client secret',
    maxBatchSize: BATCH_SIZE,
    flushTimeoutMilliseconds: FLUSH_TIMEOUT,
    fetchImplementation: mockFetch as any,
    region: 'eu',
    maxOpenRequests: MAX_OPEN_REQUESTS
  });
  const flushSpy = jest.spyOn(engine, 'flush')
  it('should write event to batch', () => {
    
  });
  it('should flush 10 millisecond after the last send', () => {
    
  });
  it('should flush once batch is full', async () => {
    for (let i = 0; i <= BATCH_SIZE; i++) {
      engine.send({i: "pants"}, "event", {"message": ""})
    }
    await jest.runAllTimersAsync()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(flushSpy).toHaveBeenCalledTimes(2)
  });
  it('should retry with delay if event failed to send', () => {

  });
  it('should close engine when done', () => {

  });
  it('should handle a lot of events', async () => {
    const eventCount = BATCH_SIZE * MAX_OPEN_REQUESTS * 2
    for (let i = 0; i < eventCount; i++) {
      engine.send({i: "pants"}, "event", {"message": ""})
    }
    await jest.runAllTimersAsync()
    expect(flushSpy).toHaveBeenCalledTimes(eventCount/BATCH_SIZE)
    expect(mockFetch).toHaveBeenCalledTimes(MAX_OPEN_REQUESTS)
    const flushResults = await Promise.all(flushSpy.mock.results.map((x) => x.value))
    expect(flushResults.slice(0, MAX_OPEN_REQUESTS).every(x => x)).toBe(true)
    expect(flushResults.slice(MAX_OPEN_REQUESTS).every(x => !x)).toBe(true)
  })
});

function sleep(millis: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, millis)
  })
}