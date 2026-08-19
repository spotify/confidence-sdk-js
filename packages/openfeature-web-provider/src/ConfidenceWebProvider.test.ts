import { EvaluationContext, OpenFeature, ProviderEvents } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { EventSender, FlagResolver, StateObserver } from '@spotify-confidence/sdk';

const confidenceMock: jest.Mocked<FlagResolver> & jest.Mocked<Pick<EventSender, 'track'>> = {
  getContext: jest.fn(),
  setContext: jest.fn(),
  withContext: jest.fn(),
  clearContext: jest.fn(),
  subscribe: jest.fn(),
  evaluateFlag: jest.fn(),
  getFlag: jest.fn(),
  track: jest.fn(),
};

const dummyContext: EvaluationContext = { targetingKey: 'test' };

describe('ConfidenceProvider', () => {
  let instanceUnderTest: ConfidenceWebProvider;

  beforeEach(() => {
    jest.resetAllMocks();
    instanceUnderTest = new ConfidenceWebProvider(confidenceMock);
    confidenceMock.withContext.mockReturnValue(confidenceMock);

    // subscribe will by default immediately emit READY
    confidenceMock.subscribe.mockImplementation(observer => {
      observer!('READY');
      return jest.fn();
    });
  });

  describe('track', () => {
    it('tracks with converted context and event details', () => {
      instanceUnderTest.track(
        'checkout',
        { targetingKey: 'user-a', registeredAt: new Date('2026-01-02T03:04:05Z') },
        { value: 42, currency: 'SEK', purchasedAt: new Date('2026-02-03T04:05:06Z') },
      );

      expect(confidenceMock.withContext).toHaveBeenCalledWith({
        targeting_key: 'user-a',
        registeredAt: '2026-01-02T03:04:05.000Z',
      });
      expect(confidenceMock.track).toHaveBeenCalledWith('checkout', {
        value: 42,
        currency: 'SEK',
        purchasedAt: '2026-02-03T04:05:06.000Z',
      });
      // Tracking with a scoped context must not subscribe to flag state or trigger reconciliation.
      expect(confidenceMock.subscribe).not.toHaveBeenCalled();
    });

    it('tracks through the OpenFeature client with global context', async () => {
      try {
        await OpenFeature.setContext({ targetingKey: 'user-a', plan: 'premium' });
        await OpenFeature.setProviderAndWait(instanceUnderTest);

        OpenFeature.getClient().track('checkout', { value: 42, currency: 'SEK' });

        expect(confidenceMock.withContext).toHaveBeenLastCalledWith({
          targeting_key: 'user-a',
          plan: 'premium',
        });
        expect(confidenceMock.track).toHaveBeenCalledWith('checkout', {
          value: 42,
          currency: 'SEK',
        });
      } finally {
        await OpenFeature.clearProviders();
        await OpenFeature.setContext({});
      }
    });
  });

  describe('initialize', () => {
    it('should resolve if the state is ready', async () => {
      await expect(instanceUnderTest.initialize({ targetingKey: 'test' })).toResolve();
    });
    it('should not set confidence context id no initial context', async () => {
      await instanceUnderTest.initialize();
      expect(confidenceMock.setContext).not.toHaveBeenCalled();
    });
    it('should setup a subscription', async () => {
      await instanceUnderTest.initialize();
      // one subscription is for the lifecycle of the provider, the other is short lived to wait for ready
      expect(confidenceMock.subscribe).toHaveBeenCalledTimes(2);
      // the first subscription should be open
      expect(confidenceMock.subscribe.mock.results[0].value).not.toHaveBeenCalled();
      // the second second subscription should be closed
      expect(confidenceMock.subscribe.mock.results[1].value).toHaveBeenCalled();
    });
  });

  describe('onClose', () => {
    it('should close all subscriptions', async () => {
      await instanceUnderTest.initialize();
      await instanceUnderTest.onContextChange({}, { targetingKey: 'x' });
      await instanceUnderTest.onClose();
      // the first subscription should be closed
      for (const { value } of confidenceMock.subscribe.mock.results) {
        // value is the close function returned from the subscription
        expect(value).toHaveBeenCalledOnce();
      }
    });
  });
  describe('onContextChange', () => {
    describe('from OpenFeature', () => {
      it('should diff context and set only the changes to confidence', async () => {
        await instanceUnderTest.onContextChange(
          { targetingKey: 'test1', pantsPattern: 'Checkered' },
          { targetingKey: 'test2', pantsColor: 'Yellow' },
        );

        expect(confidenceMock.setContext).toHaveBeenCalledTimes(1);
        expect(confidenceMock.setContext).toHaveBeenCalledWith(
          expect.objectContaining({
            targeting_key: 'test2',
            pantsColor: 'Yellow',
            pantsPattern: undefined,
          }),
        );
      });

      it('should diff context but only shallow', async () => {
        await instanceUnderTest.onContextChange(
          { targetingKey: 'test1', pants: { color: 'Green', pattern: 'Checkered' } },
          { targetingKey: 'test1', pants: { color: 'Green' } },
        );

        expect(confidenceMock.setContext).toHaveBeenCalledTimes(1);
        expect(confidenceMock.setContext).toHaveBeenCalledWith({
          pants: { color: 'Green' },
        });
      });

      it('removal of targeting key should send undefined in setContext', async () => {
        await instanceUnderTest.onContextChange(
          { targetingKey: 'test1', pants: { color: 'Green' } },
          { pants: { color: 'Yellow' } },
        );

        expect(confidenceMock.setContext).toHaveBeenCalledTimes(1);
        expect(confidenceMock.setContext).toHaveBeenCalledWith({
          targeting_key: undefined,
          pants: { color: 'Yellow' },
        });
      });

      it('should not set confidence context with equal contexts', async () => {
        await instanceUnderTest.onContextChange(dummyContext, dummyContext);

        expect(confidenceMock.setContext).not.toHaveBeenCalled();
      });
    });

    describe('from Confidence', () => {
      let stateObserver: StateObserver;

      beforeEach(() => {
        instanceUnderTest.initialize();
        const observer = confidenceMock.subscribe.mock.calls[0][0];
        if (typeof observer !== 'function') throw new Error('Expected StateObserver in test');
        stateObserver = observer;
      });
      it('should emit stale and then ready', async () => {
        const staleHandler = jest.fn();
        const readyHandler = jest.fn();
        instanceUnderTest.events.addHandler(ProviderEvents.Stale, staleHandler);
        instanceUnderTest.events.addHandler(ProviderEvents.Ready, readyHandler);

        stateObserver('STALE');

        expect(staleHandler).toHaveBeenCalledTimes(1);
        expect(readyHandler).toHaveBeenCalledTimes(0);

        stateObserver('READY');

        expect(readyHandler).toHaveBeenCalledTimes(1);
      });
    });
  });
});
