import { ProviderStatus } from '@openfeature/web-sdk';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

const withContextMock = jest.fn(function withContext() {
  return this;
});
const evaluateFlagMock = jest.fn();
const mockConfidence = {
  withContext: withContextMock,
  evaluateFlag: evaluateFlagMock,
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
});
