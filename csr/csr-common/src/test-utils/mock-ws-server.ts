import { Server, type Client } from 'mock-socket';
import { onTestFinished, vi } from 'vitest';

/**
 * Spin up a mock WebSocket server at `url`. Replaces `globalThis.WebSocket`
 * so code under test (`new WebSocket(...)`) connects to the mock. Auto-stops
 * when the current test ends.
 *
 * Helpers (always prefer these over reading `connections`/`messages` directly):
 * - `waitForConnection()` resolves with each successive client connection.
 * - `nextMessage()` resolves with the next inbound (client → server) payload.
 * - `nextMessages(n)` resolves once `n` payloads have been received.
 *
 * Must be called from within a test (or a helper called from one) so vitest
 * has a test context to attach the cleanup to.
 */
export function installMockWsServer(url: string): {
  server: Server;
  connections: Client[];
  messages: string[];
  waitForConnection: () => Promise<Client>;
  nextMessage: () => Promise<string>;
  nextMessages: (n: number) => Promise<string[]>;
} {
  const server = new Server(url);
  const connections: Client[] = [];
  const messages: string[] = [];
  let nextConnIndex = 0;
  let nextMsgIndex = 0;

  server.on('connection', (socket: Client) => {
    connections.push(socket);
    // mock-socket dispatches 'server::message' as a MessageEvent — pull the payload off `.data`.
    socket.on('message', ((event: MessageEvent | string) => {
      const data = typeof event === 'string' ? event : event.data;
      messages.push(typeof data === 'string' ? data : String(data));
    }) as (m: string | Blob | ArrayBuffer | ArrayBufferView) => void);
  });

  function waitForConnection(): Promise<Client> {
    return vi.waitFor(() => {
      if (nextConnIndex >= connections.length) {
        throw new Error('no new connection yet');
      }
      const ws = connections[nextConnIndex];
      nextConnIndex += 1;
      return ws;
    });
  }

  function nextMessage(): Promise<string> {
    return vi.waitFor(() => {
      if (nextMsgIndex >= messages.length) {
        throw new Error('no new message yet');
      }
      const message = messages[nextMsgIndex];
      nextMsgIndex += 1;
      return message;
    });
  }

  async function nextMessages(n: number): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(await nextMessage());
    return out;
  }

  onTestFinished(() => server.stop());

  return {
    server,
    connections,
    messages,
    waitForConnection,
    nextMessage,
    nextMessages,
  };
}
