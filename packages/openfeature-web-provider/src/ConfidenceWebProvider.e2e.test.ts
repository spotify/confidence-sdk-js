import { OpenFeature } from '@openfeature/web-sdk';
import axios from 'axios';
import { createConfidenceWebProvider } from './factory';

describe('ConfidenceWebProvider E2E tests', () => {
  beforeAll(() => {
    const confidenceProvider = createConfidenceWebProvider({
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

    OpenFeature.setProvider(confidenceProvider);
    return OpenFeature.setContext({
      targetingKey: 'test-a', // control
    });
  });

  it('should resolve a boolean e2e', async () => {
    const client = OpenFeature.getClient();

    expect(client.getBooleanValue('web-sdk-e2e-flag.bool', true)).toBeFalsy();
  });

  it('should resolve an int', async () => {
    const client = OpenFeature.getClient();

    expect(client.getNumberValue('web-sdk-e2e-flag.int', 10)).toEqual(3);
  });

  it('should resolve a double', async () => {
    const client = OpenFeature.getClient();

    expect(client.getNumberValue('web-sdk-e2e-flag.double', 10)).toEqual(3.5);
  });

  it('should resolve a string', async () => {
    const client = OpenFeature.getClient();

    expect(client.getStringValue('web-sdk-e2e-flag.str', 'default')).toEqual('control');
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

    expect(client.getObjectValue('web-sdk-e2e-flag.obj', {})).toEqual(expectedObject);
  });

  it('should resolve a sub value from a struct', async () => {
    const client = OpenFeature.getClient();

    expect(client.getBooleanValue('web-sdk-e2e-flag.obj.bool', true)).toBeFalsy();
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

    expect(client.getNumberDetails('web-sdk-e2e-flag.obj.double', 1)).toEqual(expectedObject);
  });
});
