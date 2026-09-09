import { describe, expect, it } from 'vitest';
import { installMockFetch, installMockWsServer, jsonResponse } from '../../test-utils';
import { CsrClient } from './csr-client';

describe('CsrClient.initSession', () => {
  it('POSTs to /v1/sessions:initSession with clientSecret', async () => {
    const { calls } = installMockFetch(() => jsonResponse({ sessionId: 'sess-1', sessionToken: 'tok-1' }));

    const client = new CsrClient('https://recording.confidence.dev', 'secret', undefined);
    const result = await client.initSession();

    expect(result).toEqual({ sessionId: 'sess-1', sessionToken: 'tok-1' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://recording.confidence.dev/v1/sessions:initSession');
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      clientSecret: 'secret',
    });
  });

  it('trims a trailing slash from apiUrl when building the init URL', async () => {
    const { calls } = installMockFetch(() => jsonResponse({ sessionId: 's', sessionToken: 't' }));

    const client = new CsrClient('https://api/', 'secret', undefined);
    await client.initSession();

    expect(calls[0].url).toBe('https://api/v1/sessions:initSession');
  });

  it('forwards context when set, omits it when empty/undefined', async () => {
    const { calls } = installMockFetch(() => jsonResponse({ sessionId: 's', sessionToken: 't' }));

    const ctx = {
      userAgent: { os: 'macos', browser: 'chrome', viewportWidth: 1440 },
    };
    const withCtx = new CsrClient('https://api', 'secret', ctx);
    await withCtx.initSession();
    expect(JSON.parse(calls[0].init!.body as string)).toEqual({
      clientSecret: 'secret',
      context: ctx,
    });

    const withEmpty = new CsrClient('https://api', 'secret', {});
    await withEmpty.initSession();
    expect(JSON.parse(calls[1].init!.body as string)).toEqual({
      clientSecret: 'secret',
    });
  });

  it('returns skipRecording when the backend asks to skip', async () => {
    installMockFetch(() => jsonResponse({ skipRecording: true }));

    const client = new CsrClient('https://api', 'secret', undefined);
    expect(await client.initSession()).toEqual({ skipRecording: true });
  });

  it('throws on non-2xx response', async () => {
    installMockFetch(() => new Response(null, { status: 500 }));

    const client = new CsrClient('https://api', 'secret', undefined);
    await expect(client.initSession()).rejects.toThrow(/HTTP 500/);
  });

  it('throws when the response is missing sessionId/sessionToken', async () => {
    installMockFetch(() => jsonResponse({ sessionId: 'x' }));

    const client = new CsrClient('https://api', 'secret', undefined);
    await expect(client.initSession()).rejects.toThrow(/missing sessionId or sessionToken/);
  });
});

describe('CsrClient.openTransport', () => {
  it('derives the unchanged ws:// endpoint and sends the token as a protocol', async () => {
    const ws = installMockWsServer('ws://api.example/sessions/stream');

    const client = new CsrClient('http://api.example', 'secret', undefined);
    await expect(client.openTransport('tok-1')).resolves.toBeDefined();

    expect(ws.connections[0].url).toBe('ws://api.example/sessions/stream');
    expect(ws.protocolOffers).toEqual([['recording.v1', 'auth.tok-1']]);
  });

  it('derives a wss:// URL from an https:// apiUrl', async () => {
    installMockWsServer('wss://api.example/sessions/stream');

    const client = new CsrClient('https://api.example', 'secret', undefined);
    await expect(client.openTransport('tok')).resolves.toBeDefined();
  });

  it('preserves unrelated query parameters in a configured websocketUrl', async () => {
    const ws = installMockWsServer('wss://recording-ws.confidence.dev/sessions/stream?region=eu');

    const client = new CsrClient(
      'https://recording.confidence.dev',
      'secret',
      undefined,
      'wss://recording-ws.confidence.dev/sessions/stream?region=eu',
    );
    await expect(client.openTransport('tok')).resolves.toBeDefined();

    expect(ws.connections[0].url).toBe('wss://recording-ws.confidence.dev/sessions/stream?region=eu');
  });

  it('keeps the credential out of the URL and debug log', async () => {
    const ws = installMockWsServer('wss://api/sessions/stream');

    const logs: string[] = [];
    const client = new CsrClient('https://api', 'secret', undefined, undefined, msg => logs.push(msg));
    await client.openTransport('sensitive-token');

    expect(logs).toHaveLength(1);
    expect(logs[0]).toBe('WebSocket connect wss://api/sessions/stream');
    for (const value of [ws.connections[0].url, ...logs]) {
      expect(value).not.toContain('sensitive-token');
    }
  });

  it.each(['wss://api/sessions/stream?session_token=legacy', 'wss://api/sessions/stream?region=eu&session_token='])(
    'rejects a configured legacy credential before logging or connecting: %s',
    async websocketUrl => {
      const ws = installMockWsServer(websocketUrl);
      const logs: string[] = [];
      const client = new CsrClient('https://api', 'secret', undefined, websocketUrl, msg => logs.push(msg));

      await expect(client.openTransport('sensitive-token')).rejects.toThrowError(
        'WebSocket URL must not include a session token',
      );
      expect(logs).toEqual([]);
      expect(ws.connections).toEqual([]);
    },
  );
});
