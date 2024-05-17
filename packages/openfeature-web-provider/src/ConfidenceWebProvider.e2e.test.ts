import { ClientProviderStatus, OpenFeature, Provider, ProviderStatus } from '@openfeature/web-sdk';
import { ConfidenceWebProviderOptions, createConfidenceWebProvider } from './factory';

OpenFeature.setLogger({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});
function createProvider(options: Partial<ConfidenceWebProviderOptions> = {}): Provider {
  return createConfidenceWebProvider({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    timeout: 1000,
    ...options,
  });
}
describe('ConfidenceWebProvider E2E tests', () => {
  describe('initialize fail', () => {
    beforeEach(async () => {
      await expect(OpenFeature.setProviderAndWait(createProvider({ timeout: 0 }))).rejects.toThrow();
    });
    afterEach(() => OpenFeature.clearProviders());

    it('should have error status', () => {
      const client = OpenFeature.getClient();
      expect(client.providerStatus).toBe(ClientProviderStatus.ERROR);
    });

    it('should resolve default values', () => {
      const client = OpenFeature.getClient();

      expect(client.getStringDetails('web-sdk-e2e-flag.str', 'default')).toEqual({
        errorCode: 'PROVIDER_NOT_READY',
        flagKey: 'web-sdk-e2e-flag.str',
        flagMetadata: {},
        stale: true,
        errorMessage: 'Provider is not yet ready',
        then: expect.any(Function),
        reason: 'ERROR',
        value: 'default',
      });
    });
  });

  describe('initialize success', () => {
    beforeEach(async () => {
      OpenFeature.setContext({ targetingKey: 'test-a' }); // control
      await OpenFeature.setProviderAndWait(createProvider({ timeout: 1000 }));
    });
    afterEach(() => OpenFeature.clearProviders());

    it('should have ready status', () => {
      const client = OpenFeature.getClient();
      expect(client.providerStatus).toBe(ProviderStatus.READY);
    });

    it('should resolve a boolean e2e', async () => {
      const client = OpenFeature.getClient();

      expect(client.getBooleanValue('web-sdk-e2e-flag.bool', true)).toBe(false);
    });

    it('should resolve an int', async () => {
      const client = OpenFeature.getClient();

      expect(client.getNumberValue('web-sdk-e2e-flag.int', 10)).toBe(3);
    });

    it('should resolve a double', async () => {
      const client = OpenFeature.getClient();

      expect(client.getNumberValue('web-sdk-e2e-flag.double', 10)).toBe(3.5);
    });

    it('should resolve a string', async () => {
      const client = OpenFeature.getClient();

      expect(client.getStringValue('web-sdk-e2e-flag.str', 'default')).toBe('control');
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

      expect(client.getBooleanValue('web-sdk-e2e-flag.obj.bool', true)).toBe(false);
    });

    it('should resolve a sub value from a struct with details with resolve token for client side apply call', async () => {
      const client = OpenFeature.getClient();
      const expectedObject = {
        flagKey: 'web-sdk-e2e-flag.obj.double',
        flagMetadata: {},
        reason: 'MATCH',
        stale: false,
        variant: 'flags/web-sdk-e2e-flag/variants/control',
        value: 3.6,
      };

      expect(client.getNumberDetails('web-sdk-e2e-flag.obj.double', 1)).toEqual(expectedObject);
    });
  });
});
