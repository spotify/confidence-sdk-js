import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { FlagResolver } from '@spotify-confidence/sdk';

function createConfidenceMock(): jest.Mocked<FlagResolver> {
  return {
    getContext: jest.fn(),
    setContext: jest.fn(),
    withContext: jest.fn(),
    clearContext: jest.fn(),
    subscribe: jest.fn(),
    evaluateFlag: jest.fn(),
    getFlag: jest.fn(),
  };
}

describe('ConfidenceWebProvider - AbortError recovery', () => {
  let confidenceMock: jest.Mocked<FlagResolver>;

  beforeEach(() => {
    confidenceMock = createConfidenceMock();
  });

  it('initialize rejects when resolve fails and state transitions to ERROR', async () => {
    // After fix: when a resolve fails (including AbortError), the SDK
    // transitions to ERROR. subscribe emits NOT_READY then ERROR.
    // expectReadyOrError() sees ERROR and rejects with an appropriate error.
    confidenceMock.subscribe.mockImplementation(observer => {
      observer!('NOT_READY');
      setTimeout(() => observer!('ERROR'), 10);
      return jest.fn();
    });

    const provider = new ConfidenceWebProvider(confidenceMock);

    // Expected: initialize rejects because expectReadyOrError sees ERROR
    await expect(provider.initialize({ targetingKey: 'test' })).rejects.toThrow('Provider initialization failed');
    await provider.onClose();
  });

  it('onContextChange rejects when resolve fails after context change', async () => {
    // Step 1: Initialize succeeds normally
    confidenceMock.subscribe.mockImplementation(observer => {
      observer!('READY');
      return jest.fn();
    });

    const provider = new ConfidenceWebProvider(confidenceMock);
    await provider.initialize({ targetingKey: 'test' });

    // Step 2: After context change, resolve fails and SDK transitions
    // through STALE to ERROR. expectReadyOrError() sees ERROR and rejects.
    confidenceMock.subscribe.mockImplementation(observer => {
      observer!('STALE');
      setTimeout(() => observer!('ERROR'), 10);
      return jest.fn();
    });

    // Expected: onContextChange rejects because expectReadyOrError sees ERROR
    await expect(
      provider.onContextChange({ targetingKey: 'test' }, { targetingKey: 'test2' }),
    ).rejects.toThrow('Provider initialization failed');
    await provider.onClose();
  });
});
