import { ProviderStatus } from '@openfeature/web-sdk';
import { Confidence } from '@spotify-confidence/sdk';
import { ConfidenceServerProvider } from './ConfidenceServerProvider';

const mockApply = jest.fn();
jest.mock('@spotify-confidence/client-http', () => {
  return {
    ...jest.requireActual('@spotify-confidence/client-http'),
    ApplyManager: jest.fn().mockImplementation(() => ({
      apply: mockApply,
    })),
  };
});

const resolveFlagsMock = jest.fn();
const evaluateMock = jest.fn();
const flagResolutionMock = {
  evaluate: evaluateMock,
};
const withContextMock = jest.fn(function withContext() {
  return this;
});
const evaluateFlagMock = jest.fn();
const mockConfidence = {
  resolveFlags: resolveFlagsMock,
  apply: jest.fn(),
  withContext: withContextMock,
  evaluateFlag: evaluateFlagMock,
} as unknown as Confidence;

describe('ConfidenceServerProvider', () => {
  let instanceUnderTest: ConfidenceServerProvider;

  beforeEach(() => {
    instanceUnderTest = new ConfidenceServerProvider(mockConfidence);
    resolveFlagsMock.mockResolvedValue(flagResolutionMock);
    evaluateMock.mockReturnValue({
      reason: 'ERROR',
      value: 'Test',
      errorCode: 'GENERAL',
      errorMessage: 'Test error',
    });
    evaluateFlagMock.mockReturnValue({
      reason: 'MATCH',
      value: 'Test',
    });
  });

  it('should change the provider status to READY', async () => {
    expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
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
