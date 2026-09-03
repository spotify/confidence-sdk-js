import { describe, expect, it, vi } from 'vitest';
import { installAuthenticatedMockWsServer, installMockWsServer } from '../../test-utils';
import { WebSocketTransport } from './web-socket-transport';

const URL = 'ws://localhost:1234/sessions/stream';
const TOKEN = 'secret-token';

describe('WebSocketTransport', () => {
  const setup = () => installAuthenticatedMockWsServer(URL);

  it('resolves ready() once the server accepts the connection', async () => {
    setup();
    const t = new WebSocketTransport(URL, TOKEN);
    await expect(t.ready()).resolves.toBeUndefined();
  });

  it('sends authentication as the first frame', async () => {
    const { nextMessage } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    await t.ready();

    expect(JSON.parse(await nextMessage())).toEqual({ type: 'authenticate', token: TOKEN });
  });

  it('waits for the authentication acknowledgement before becoming ready', async () => {
    const { messages, nextMessage, waitForConnection } = installMockWsServer(URL);
    const t = new WebSocketTransport(URL, TOKEN);
    const connection = await waitForConnection();

    expect(JSON.parse(await nextMessage())).toEqual({ type: 'authenticate', token: TOKEN });
    t.send({ tabId: 'tab-1', eventCounter: 0, data: 'buffered' });
    let ready = false;
    void t.ready().then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    expect(messages).toHaveLength(1);

    connection.send(JSON.stringify({ type: 'authenticated' }));
    await expect(t.ready()).resolves.toBeUndefined();
    expect(JSON.parse(await nextMessage()).data).toBe('buffered');
  });

  it('rejects ready() when no server is reachable', async () => {
    // Decoy server patches global WebSocket without registering one at URL — mock-socket
    // fires close(1000) synchronously instead of leaning on the OS to refuse the connect.
    installMockWsServer('ws://localhost:9999/decoy');
    const t = new WebSocketTransport(URL, TOKEN);
    await expect(t.ready()).rejects.toThrow(/initial-failed/);
  });

  it('sends frames as JSON once open', async () => {
    const { nextMessages } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    await t.ready();

    t.send({ tabId: 'tab-1', eventCounter: 0, data: { hello: 'world' } });

    const [, frame] = await nextMessages(2);
    expect(JSON.parse(frame)).toEqual({
      tabId: 'tab-1',
      eventCounter: 0,
      data: { hello: 'world' },
    });
  });

  it('buffers frames sent before open and flushes them on connect', async () => {
    const { nextMessages } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    // Synchronously enqueue before the open event fires.
    t.send({ tabId: 'a', eventCounter: 0, data: 1 });
    t.send({ tabId: 'a', eventCounter: 1, data: 2 });
    await t.ready();

    const [, first, second] = await nextMessages(3);
    expect([JSON.parse(first).eventCounter, JSON.parse(second).eventCounter]).toEqual([0, 1]);
  });

  it('reconnects on a graceful drain (code 1000) and emits state changes', async () => {
    const { nextMessage, waitForConnection } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    const states: boolean[] = [];
    t.onStateChange(({ connected }) => states.push(connected));
    await t.ready();
    expect(JSON.parse(await nextMessage())).toEqual({ type: 'authenticate', token: TOKEN });

    const first = await waitForConnection();
    first.close({ code: 1000, reason: 'drain', wasClean: true });
    await waitForConnection(); // reconnect lands
    expect(JSON.parse(await nextMessage())).toEqual({ type: 'authenticate', token: TOKEN });

    // First open → no state event (welcome implies connected).
    // Drain → state(false). Reconnect open → state(true).
    await vi.waitFor(() => expect(states).toEqual([false, true]));
  });

  it('fires onClose with reason on abrupt close after open', async () => {
    const { waitForConnection } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    const closeReasons: string[] = [];
    t.onClose(({ reason }) => closeReasons.push(reason));
    await t.ready();

    const ws = await waitForConnection();
    ws.close({ code: 1011, reason: 'server crash', wasClean: false });

    await vi.waitFor(() => expect(closeReasons).toHaveLength(1));
    expect(closeReasons[0]).toMatch(/code=1011/);
  });

  it('drops sends after close()', async () => {
    const { nextMessage } = setup();
    const t = new WebSocketTransport(URL, TOKEN);
    await t.ready();
    await nextMessage(); // authentication

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
    const t2 = new WebSocketTransport(URL, TOKEN);
    await t2.ready();
    await nextMessage(); // authentication
    t2.send({ tabId: 'b', eventCounter: 0, data: 'marker' });
    expect(JSON.parse(await nextMessage()).data).toBe('marker');
  });
});
