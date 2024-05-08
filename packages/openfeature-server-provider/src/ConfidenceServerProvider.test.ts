import { Logger, ProviderStatus } from '@openfeature/web-sdk';
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
const mockConfidence = {
  resolveFlags: resolveFlagsMock,
  apply: jest.fn(),
  withContext: withContextMock,
} as unknown as Confidence;

const dummyConsole: Logger = {
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};
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
  });

  it('should change the provider status to READY', async () => {
    expect(instanceUnderTest.status).toEqual(ProviderStatus.READY);
  });

  it('should make a network request on each flag resolve', async () => {
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole);
    await instanceUnderTest.resolveBooleanEvaluation('testFlag.bool', false, {}, dummyConsole);

    expect(resolveFlagsMock).toHaveBeenCalledTimes(2);
  });
});
