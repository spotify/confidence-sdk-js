import { Confidence } from './Confidence';

describe('Confidence E2E Tests', () => {
  const loggerMock = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const confidence = Confidence.create({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    environment: 'client',
    region: 'eu',
    timeout: 1000,
    logger: loggerMock,
  });

  describe('resolving flags', () => {
    it('should', async () => {
      // const close = confidence.subscribe(state => {
      //   console.log(state);
      // });
      // confidence.setContext({ targeting_key: 'test-a' });
      const fe = await confidence.evaluateFlag('web-sdk-e2e-flag.int', 0);
      console.log(fe);
      // close();
    });
  });

  describe('track event sends an event', () => {
    it('should log a trace message when all events succeed', async () => {
      confidence.track('js-sdk-e2e-tests', { pants: 'blue' });
      confidence.track('js-sdk-e2e-tests', { pants: 'yellow' });
      expect(await nextMockArgs(loggerMock.info)).toEqual(['Confidence: successfully uploaded %i events', 2]);
    });
    it('should log a warning message when some events fail', async () => {
      confidence.track('js-sdk-e2e-tests', { pants: 'red' });
      confidence.track('js-sdk-e2e-tests', { pants: 3 });
      confidence.track('js-sdk-e2e-tests', { pants: true });
      confidence.track('js-sdk-e2e-tests', { pants: 4 });

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
