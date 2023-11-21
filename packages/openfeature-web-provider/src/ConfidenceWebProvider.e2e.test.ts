import { GeneralError, OpenFeature, ProviderEvents, ProviderStatus } from '@openfeature/web-sdk';
import axios from 'axios';
import { createConfidenceWebProvider } from './factory';

describe('ConfidenceHTTPProvider E2E tests', () => {
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
      timeout: 1000,
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

  describe('timeout', () => {
    it('should have error status and throw provider not ready when timeout hit', async () => {
      const confidenceProvider = createConfidenceWebProvider({
        fetchImplementation: global.fetch.bind(global),
        region: 'eu',
        clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
        timeout: 0,
      });

      await confidenceProvider.onContextChange!({}, { targetingKey: 'user-a' });

      expect(confidenceProvider.status).toEqual(ProviderStatus.ERROR);
      expect(() =>
        confidenceProvider.resolveBooleanEvaluation(
          'web-sdk-e2e-flag.bool',
          true,
          { targetingKey: 'user-a' },
          {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        ),
      ).toThrow(new GeneralError('Provider not ready'));
    });

    it('should have ready status and return values when timeout not hit', async () => {
      const confidenceProvider = createConfidenceWebProvider({
        fetchImplementation: global.fetch.bind(global),
        region: 'eu',
        clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
        timeout: 1000,
      });

      await confidenceProvider.onContextChange!({}, { targetingKey: 'user-a' });

      expect(confidenceProvider.status).toEqual(ProviderStatus.READY);
      expect(
        confidenceProvider.resolveBooleanEvaluation(
          'web-sdk-e2e-flag.bool',
          true,
          { targetingKey: 'user-a' },
          {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        ),
      ).toBeTruthy();
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
