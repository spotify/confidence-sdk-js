import { OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { createConfidenceWebProvider } from './factory';
import { Confidence } from '@spotify-confidence/sdk';

describe('ConfidenceHTTPProvider E2E tests', () => {
  beforeAll(() => {
    const confidence: Confidence = Confidence.create({
      clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
      timeout: 1000,
      environment: 'client',
    });
    const confidenceProvider = createConfidenceWebProvider(confidence);
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

  it('should return defaults after the timeout', async () => {
    const confidence: Confidence = Confidence.create({
      clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
      region: 'eu',
      timeout: 0,
      environment: 'client',
    });

    const confidenceProvider = createConfidenceWebProvider(confidence);

    await confidenceProvider.onContextChange!({}, { targetingKey: 'user-a' });

    const flag = confidenceProvider.resolveStringEvaluation(
      'web-sdk-e2e-flag.str',
      'default',
      { targetingKey: 'user-a' },
      {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    );

    expect(flag.value).toEqual('default');
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
