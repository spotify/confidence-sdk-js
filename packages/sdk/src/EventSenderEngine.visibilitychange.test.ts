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

  it('should flush with keepalive when document becomes hidden', async () => {
    const engine = new EventSenderEngine({
      clientSecret: 'my_secret',
      maxBatchSize: BATCH_SIZE,
      flushTimeoutMilliseconds: FLUSH_TIMEOUT,
      fetchImplementation: mockFetch as any,
      region: 'eu',
      maxOpenRequests: MAX_OPEN_REQUESTS,
      logger: {},
    });
    const uploadSpy = jest.spyOn(engine, 'upload');
    engine.send({ value: 1 }, 'my_event');

    expect(uploadSpy).not.toHaveBeenCalled();

    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Object), { keepalive: true });

    await jest.runAllTimersAsync();
  });

  it('should not use keepalive for regular flushes', async () => {
    const engine = new EventSenderEngine({
      clientSecret: 'my_secret',
      maxBatchSize: BATCH_SIZE,
      flushTimeoutMilliseconds: FLUSH_TIMEOUT,
      fetchImplementation: mockFetch as any,
      region: 'eu',
      maxOpenRequests: MAX_OPEN_REQUESTS,
      logger: {},
    });
    const uploadSpy = jest.spyOn(engine, 'upload');
    engine.send({ value: 1 }, 'my_event');

    await jest.advanceTimersByTimeAsync(FLUSH_TIMEOUT);

    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(expect.any(Object), { keepalive: undefined });

    await jest.runAllTimersAsync();
  });
});
