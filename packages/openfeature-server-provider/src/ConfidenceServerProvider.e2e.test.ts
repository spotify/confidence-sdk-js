import { OpenFeature } from '@openfeature/server-sdk';
import { createConfidenceServerProvider } from './factory';

describe('ConfidenceServerProvider E2E tests', () => {
  beforeEach(() => {
    const confidenceProvider = createConfidenceServerProvider({
      clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
      timeout: 2000,
    });

    OpenFeature.setProvider(confidenceProvider);
    OpenFeature.setContext({
      targetingKey: 'test-a', // control
    });
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
      reason: 'MATCH',
      stale: false,
      variant: 'flags/web-sdk-e2e-flag/variants/control',
      flagMetadata: {},
      value: 3.6,
    };

    expect(await client.getNumberDetails('web-sdk-e2e-flag.obj.double', 1)).toEqual(expectedObject);
  });
});
