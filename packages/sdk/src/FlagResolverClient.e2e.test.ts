import { FlagResolverClient } from './FlagResolverClient';
import { SdkId } from './generated/confidence/flags/resolver/v1/types';

describe('FlagResolverClient E2E tests', () => {
  const client = new FlagResolverClient({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    fetchImplementation: fetch.bind(globalThis),
    sdk: {
      id: SdkId.SDK_ID_JS_CONFIDENCE,
      version: '0.0.2-test',
    },
  });
  it('can resolve flags', async () => {
    const resp = await client.resolve({ targeting_key: 'user-a' }, []);
    console.log(resp.evaluate('web-sdk-e2e-flag.str', '3'));
  });
});
