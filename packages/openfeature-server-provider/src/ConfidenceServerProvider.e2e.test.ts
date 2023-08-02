import { OpenFeature, ProviderEvents } from '@openfeature/js-sdk';
import axios from 'axios';
import { createConfidenceServerProvider } from './factory';

describe('ConfidenceServerProvider E2E tests', () => {
  beforeAll(() => {
    const confidenceProvider = createConfidenceServerProvider({
      fetchImplementation: async (url, request): Promise<Response> => {
        return await axios.post(url as string, request?.body).then(
          resp =>
            ({
              json: async () => {
                return resp.data;
              },
            } as Response),
        );
      },
      region: 'eu',
      clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    });
    const providerReadyPromise = new Promise<void>(resolve => {
      OpenFeature.addHandler(ProviderEvents.Ready, () => {
        resolve();
      });
    }).then(() => {
      return OpenFeature.setContext({
        targetingKey: 'test-a', // control
      });
    });

    OpenFeature.setProvider(confidenceProvider);

    return providerReadyPromise;
  });

  it('should resolve a boolean e2e', async () => {
    const client = OpenFeature.getClient();

    expect(await client.getBooleanValue('web-sdk-e2e-flag.bool', true)).toBeFalsy();
  });

  it('should resolve an int', async () => {
    const client = OpenFeature.getClient();

    expect(await client.getNumberValue('web-sdk-e2e-flag.int', 10)).toEqual(3);
  });

  it('should resolve a double', async () => {
    const client = OpenFeature.getClient();

    expect(await client.getNumberValue('web-sdk-e2e-flag.double', 10)).toEqual(3.5);
  });

  it('should resolve a string', async () => {
    const client = OpenFeature.getClient();

    expect(await client.getStringValue('web-sdk-e2e-flag.str', 'default')).toEqual('control');
  });

  it('should resolve a struct', async () => {
    const client = OpenFeature.getClient();
    const expectedObject = {
      int: 4,
      str: 'obj control',
      bool: false,
      double: 3.6,
      ['obj-obj']: {},
    };

    expect(await client.getObjectValue('web-sdk-e2e-flag.obj', {})).toEqual(expectedObject);
  });

  it('should resolve a sub value from a struct', async () => {
    const client = OpenFeature.getClient();

    expect(await client.getBooleanValue('web-sdk-e2e-flag.obj.bool', true)).toBeFalsy();
  });

  it('should resolve a sub value from a struct with details with resolve token for client side apply call', async () => {
    const client = OpenFeature.getClient();
    const expectedObject = {
      flagKey: 'web-sdk-e2e-flag.obj.double',
      reason: 'TARGETING_MATCH',
      variant: 'flags/web-sdk-e2e-flag/variants/control',
      flagMetadata: {
        resolveToken: expect.any(String),
      },
      value: 3.6,
    };

    expect(await client.getNumberDetails('web-sdk-e2e-flag.obj.double', 1)).toEqual(expectedObject);
  });
});
