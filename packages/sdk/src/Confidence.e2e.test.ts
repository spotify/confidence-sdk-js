import { Confidence } from './Confidence';

describe('Confidence E2E Tests', () => {
  const loggerMock = {
    trace: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const confidence = Confidence.create({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    environment: 'backend',
    region: 'eu',
    timeout: 100,
    logger: loggerMock,
  });

  describe('sendEvent', () => {
    it('should log a trace message when all events succeed', async () => {
      confidence.sendEvent('js-sdk-e2e-test', { pants: 'blue' });
      confidence.sendEvent('js-sdk-e2e-test', { pants: 'yellow' });
      expect(await nextMockArgs(loggerMock.trace)).toEqual(['Confidence: successfully uploaded %i events', 2]);
    });
    it('should log a warning message when some events fail', async () => {
      confidence.sendEvent('js-sdk-e2e-test', { pants: 'red' });
      confidence.sendEvent('js-sdk-e2e-test', { pants: 3 });
      confidence.sendEvent('js-sdk-e2e-test', { pants: true });
      confidence.sendEvent('js-sdk-e2e-test', { pants: 4 });

      expect(await nextMockArgs(loggerMock.warn)).toEqual([
        'Confidence: failed to upload %i out of %i event(s) with the following errors: %o',
        3,
        4,
        [
          'pants: Field was expected to be of type string, was number',
          'pants: Field was expected to be of type string, was bool',
        ],
      ]);
    });
  });
});

function nextMockArgs<A extends any[]>(mock: jest.Mock<any, A>): Promise<A> {
  return new Promise(resolve => {
    const realImpl = mock.getMockImplementation();
    mock.mockImplementationOnce((...args: A) => {
      try {
        return realImpl?.(...args);
      } finally {
        resolve(args);
      }
    });
  });
}
