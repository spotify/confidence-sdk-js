import { describe, expect, it, vi } from 'vitest';
import { installMockWsServer } from '../../test-utils';
import { WebSocketTransport } from './web-socket-transport';

const URL = 'ws://localhost:1234/sessions/stream?session_token=abc';

describe('WebSocketTransport', () => {
  const setup = () => installMockWsServer(URL);

  it('resolves ready() once the server accepts the connection', async () => {
    setup();
    const t = new WebSocketTransport(URL);
    await expect(t.ready()).resolves.toBeUndefined();
  });

  it('rejects ready() when no server is reachable', async () => {
    // Decoy server patches global WebSocket without registering one at URL — mock-socket
    // fires close(1000) synchronously instead of leaning on the OS to refuse the connect.
    installMockWsServer('ws://localhost:9999/decoy');
    const t = new WebSocketTransport(URL);
    await expect(t.ready()).rejects.toThrow(/initial-failed/);
  });

  it('sends frames as JSON once open', async () => {
    const { nextMessage } = setup();
    const t = new WebSocketTransport(URL);
    await t.ready();

    t.send({ tabId: 'tab-1', eventCounter: 0, data: { hello: 'world' } });

    expect(JSON.parse(await nextMessage())).toEqual({
      tabId: 'tab-1',
      eventCounter: 0,
      data: { hello: 'world' },
    });
  });

  it('buffers frames sent before open and flushes them on connect', async () => {
    const { nextMessages } = setup();
    const t = new WebSocketTransport(URL);
    // Synchronously enqueue before the open event fires.
    t.send({ tabId: 'a', eventCounter: 0, data: 1 });
    t.send({ tabId: 'a', eventCounter: 1, data: 2 });
    await t.ready();

    const [first, second] = await nextMessages(2);
    expect([JSON.parse(first).eventCounter, JSON.parse(second).eventCounter]).toEqual([0, 1]);
  });

  it('reconnects on a graceful drain (code 1000) and emits state changes', async () => {
    const { waitForConnection } = setup();
    const t = new WebSocketTransport(URL);
    const states: boolean[] = [];
    t.onStateChange(({ connected }) => states.push(connected));
    await t.ready();

    const first = await waitForConnection();
    first.close({ code: 1000, reason: 'drain', wasClean: true });
    await waitForConnection(); // reconnect lands

    // First open → no state event (welcome implies connected).
    // Drain → state(false). Reconnect open → state(true).
    await vi.waitFor(() => expect(states).toEqual([false, true]));
  });

  it('fires onClose with reason on abrupt close after open', async () => {
    const { waitForConnection } = setup();
    const t = new WebSocketTransport(URL);
    const closeReasons: string[] = [];
    t.onClose(({ reason }) => closeReasons.push(reason));
    await t.ready();

    const ws = await waitForConnection();
    ws.close({ code: 1011, reason: 'server crash', wasClean: false });

    await vi.waitFor(() => expect(closeReasons).toHaveLength(1));
    expect(closeReasons[0]).toMatch(/code=1011/);
  });

  it('drops sends after close()', async () => {
    const { messages, nextMessage } = setup();
    const t = new WebSocketTransport(URL);
    await t.ready();

    // Send a frame before close — should arrive. Use it as a synchronization
    // point so we know the server has caught up; anything after close() that
    // had leaked through would already be in `messages` too.
    t.send({ tabId: 'a', eventCounter: 0, data: 'before' });
    await nextMessage();

    t.close('test-shutdown');
    t.send({ tabId: 'a', eventCounter: 99, data: 'after' });

    // Send another marker on a *fresh* transport to the same server. Once it
    // arrives, the closed transport's bad send (if it had leaked) would have
    // landed first — assert by counting.
    const t2 = new WebSocketTransport(URL);
    await t2.ready();
    t2.send({ tabId: 'b', eventCounter: 0, data: 'marker' });
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(messages.map(m => JSON.parse(m).data)).toEqual(['before', 'marker']);
  });
});
