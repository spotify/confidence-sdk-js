import { Confidence } from './Confidence';

const mockResponseJson = {
  resolvedFlags: [
    {
      flag: 'flags/flag1',
      variant: 'treatment',
      value: { str: 'hello' },
      flagSchema: { schema: { str: { stringSchema: {} } } },
      reason: 'RESOLVE_REASON_MATCH',
    },
  ],
  resolveToken: 'xyz',
};

describe('Confidence integration tests', () => {
  const fetchMock = jest.fn();
  let confidence: Confidence;

  beforeEach(() => {
    confidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation: fetchMock,
    });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(mockResponseJson)));
  });

  it('should not resolve multiple times in the same tick', async () => {
    confidence.setContext({ pants: 'yellow' });
    confidence.resolveFlags();
    confidence.setContext({ pants: 'blue' });
    await confidence.resolveFlags();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
