/** @jest-environment jsdom */
import { EventSenderEngine } from './EventSenderEngine';
import { publishTrackedEvent } from './event-global';

function engine() {
  const sender = new EventSenderEngine({
    clientSecret: 'secret',
    maxBatchSize: 100,
    flushTimeoutMilliseconds: 0,
    fetchImplementation: jest.fn(),
    maxOpenRequests: 1,
    logger: {},
  });
  const upload = jest.spyOn(sender, 'upload').mockResolvedValue([]);
  return { sender, upload };
}

afterEach(() => {
  delete window.__confidence;
});

it('does not create history or a global when there are no subscribers', () => {
  publishTrackedEvent({ name: 'before-recording', timestamp: 123, correlationId: 'id' });
  expect(window.__confidence).toBeUndefined();
});

it('publishes every occurrence at queue time, with no payload/context and no flush duplicates', async () => {
  const listener = jest.fn();
  window.__confidence = { events: { listeners: new Set([listener]) } };
  const { sender, upload } = engine();
  sender.send({ user: 'private' }, 'search-failed', { query: 'private' });
  sender.send({}, 'search-failed');
  expect(listener).toHaveBeenCalledTimes(2);
  expect(listener.mock.calls[0][0]).toEqual({
    name: 'search-failed',
    timestamp: expect.any(Number),
    correlationId: expect.any(String),
  });
  expect(listener.mock.calls[1][0].correlationId).not.toBe(listener.mock.calls[0][0].correlationId);
  await sender.flush();
  expect(listener).toHaveBeenCalledTimes(2);
  const [[batch]] = upload.mock.calls;
  expect(batch.events[0].eventTime).toBe(new Date(listener.mock.calls[0][0].timestamp).toISOString());
  expect(batch.events[0].correlationId).toBe(listener.mock.calls[0][0].correlationId);
  expect(batch.events[1].correlationId).toBe(listener.mock.calls[1][0].correlationId);
  expect(batch.events[0].payload).toEqual({ context: { user: 'private' }, query: 'private' });
});

it('isolates throwing and mutating listeners from uploads and other listeners', async () => {
  const listener = jest.fn();
  window.__confidence = {
    events: {
      listeners: new Set([
        event => {
          event.name = 'changed';
          throw new Error('observer failed');
        },
        listener,
      ]),
    },
  };
  const { sender, upload } = engine();
  expect(() => sender.send({}, 'original')).not.toThrow();
  expect(listener).toHaveBeenCalledWith({
    name: 'original',
    timestamp: expect.any(Number),
    correlationId: expect.any(String),
  });
  await sender.flush();
  expect(upload.mock.calls[0][0].events[0].eventDefinition).toBe('original');
});

it('does not publish rejected events', () => {
  const listener = jest.fn();
  window.__confidence = { events: { listeners: new Set([listener]) } };
  // @ts-expect-error context is reserved; this checks the runtime guard for untyped callers.
  expect(() => engine().sender.send({}, 'bad', { context: {} })).toThrow();
  expect(listener).not.toHaveBeenCalled();
});
