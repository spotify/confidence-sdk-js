import { OpenFeature, ProviderStatus } from '@openfeature/server-sdk';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

const withContextMock = jest.fn(function withContext() {
  return this;
});
const evaluateFlagMock = jest.fn();
const trackMock = jest.fn();
const mockConfidence = {
  withContext: withContextMock,
  evaluateFlag: evaluateFlagMock,
  track: trackMock,
} as unknown as Confidence;

const evaluation = {
  reason: 'MATCH',
  value: 'Test',
  variant: 'flags/web-sdk-e2e-flag/variants/control',
};

describe('ConfidenceServerProvider', () => {
  let instanceUnderTest: ConfidenceServerProvider;

  beforeEach(() => {
    instanceUnderTest = new ConfidenceServerProvider(mockConfidence);
    evaluateFlagMock.mockReturnValue(evaluation);
  });

  it('should change the provider status to READY', async () => {
    expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
  });

  it('should evaluate a flag', async () => {
    const first = await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, { some_context: 'value' });
    expect(first).toEqual(evaluation);
  });

  it('should spin off a new Confidence instance with the context on each flag resolve', async () => {
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, { some_context: 'value' });
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, { another_context: 5 });

    expect(withContextMock).toHaveBeenCalledTimes(2);
    expect(withContextMock).toHaveBeenNthCalledWith(1, { some_context: 'value' });
    expect(withContextMock).toHaveBeenNthCalledWith(2, { another_context: 5 });

    expect(evaluateFlagMock).toHaveBeenCalledTimes(2);
  });

  it('should track with converted context and event details', () => {
    instanceUnderTest.track(
      'checkout',
      { targetingKey: 'user-a', registeredAt: new Date('2026-01-02T03:04:05Z') },
      { value: 42, currency: 'SEK', purchasedAt: new Date('2026-02-03T04:05:06Z') },
    );

    expect(withContextMock).toHaveBeenCalledWith({
      targeting_key: 'user-a',
      registeredAt: '2026-01-02T03:04:05.000Z',
    });
    expect(trackMock).toHaveBeenCalledWith('checkout', {
      value: 42,
      currency: 'SEK',
      purchasedAt: '2026-02-03T04:05:06.000Z',
    });
  });

  it('should ignore a reserved context event detail', () => {
    instanceUnderTest.track(
      'checkout',
      { targetingKey: 'user-a' },
      {
        value: 42,
        // @ts-expect-error context is reserved for the evaluation context
        context: { source: 'event-details' },
      },
    );

    expect(withContextMock).toHaveBeenCalledWith({ targeting_key: 'user-a' });
    expect(trackMock).toHaveBeenCalledWith('checkout', { value: 42 });
  });

  it('should track through the OpenFeature client with merged context', async () => {
    try {
      OpenFeature.setContext({ targetingKey: 'global', plan: 'premium' });
      await OpenFeature.setProviderAndWait(instanceUnderTest);

      OpenFeature.getClient().track(
        'checkout',
        { targetingKey: 'user-a', requestId: 'request-a' },
        { value: 42, currency: 'SEK' },
      );

      expect(withContextMock).toHaveBeenLastCalledWith({
        targeting_key: 'user-a',
        plan: 'premium',
        requestId: 'request-a',
      });
      expect(trackMock).toHaveBeenCalledWith('checkout', {
        value: 42,
        currency: 'SEK',
      });
    } finally {
      await OpenFeature.clearProviders();
      OpenFeature.setContext({});
    }
  });
});
