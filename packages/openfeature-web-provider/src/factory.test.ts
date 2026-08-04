import { Provider } from '@openfeature/web-sdk';
import { ConfidenceWebProviderOptions, createConfidenceWebProvider } from './factory';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Resolves the provider's initial context, and reports where it went */
async function resolveOnce(options: Partial<ConfidenceWebProviderOptions> = {}) {
  const fetchImpl = jest.fn(async (url: any, init: any) => {
    void url;
    void init;
    return jsonResponse({ resolvedFlags: [], resolveId: 'resolve-123' });
  });
  const provider: Provider = createConfidenceWebProvider({
    clientSecret: 'test-client-secret',
    timeout: 1000,
    fetchImplementation: fetchImpl as unknown as typeof fetch,
    ...options,
  });
  await provider.initialize?.({});
  const [url, init] = fetchImpl.mock.calls[0]!;
  return { url: String(url), body: JSON.parse(init.body) };
}

describe('createConfidenceWebProvider', () => {
  it('identifies itself to the resolver, so provider traffic can be told apart', async () => {
    const { body } = await resolveOnce();
    expect(body.sdk).toEqual({ id: 'SDK_ID_JS_WEB_PROVIDER', version: expect.any(String) });
  });

  it('resolves against the global resolver by default', async () => {
    const { url } = await resolveOnce();
    expect(url).toBe('https://resolver.confidence.dev/v1/flags:resolve');
  });

  it('resolves against a regional resolver', async () => {
    const { url } = await resolveOnce({ region: 'eu' });
    expect(url).toBe('https://resolver.eu.confidence.dev/v1/flags:resolve');
  });

  it('prefers an explicit resolve url over the region', async () => {
    const { url } = await resolveOnce({ region: 'eu', resolveBaseUrl: 'https://resolver.internal' });
    expect(url).toBe('https://resolver.internal/v1/flags:resolve');
  });
});
