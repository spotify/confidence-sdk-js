import { Confidence } from './Confidence';
import { abortableSleep } from './fetch-util';

const mockResolveResponse = {
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

const mockPublishResponse = {
  errors: [],
};

const resolveHandlerMock = jest.fn();
const applyHandlerMock = jest.fn();
const publishHandlerMock = jest.fn();

const fetchImplementation = async (request: Request): Promise<Response> => {
  await abortableSleep(10, request.signal);

  let handler: (reqBody: any) => any;
  switch (request.url) {
    case 'https://custom.dev/v1/flags:resolve':
    case 'https://resolver.confidence.dev/v1/flags:resolve':
      handler = resolveHandlerMock;
      break;
    case 'https://resolver.confidence.dev/v1/flags:apply':
      handler = applyHandlerMock;
      break;
    case 'https://events.confidence.dev/v1/events:publish':
      handler = publishHandlerMock;
      break;
    default:
      throw new Error(`Unknown url: ${request.url}`);
  }
  try {
    const result = await handler(await request.json());
    return new Response(JSON.stringify(result));
  } catch (e: any) {
    return new Response(null, { status: 500, statusText: e.message });
  }
};

describe('Confidence integration tests', () => {
  let confidence: Confidence;

  beforeEach(() => {
    confidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
    });

    resolveHandlerMock.mockReturnValue(mockResolveResponse);
    publishHandlerMock.mockReturnValue(mockPublishResponse);
  });

  it('should resolve against provided base url', async () => {
    const customCondifence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
      resolveBaseUrl: 'https://custom.dev',
    });

    expect(await customCondifence.getFlag('flag1.str', 'goodbye')).toBe('hello');
  });

  it('should resolve a value and send apply', async () => {
    expect(await confidence.getFlag('flag1.str', 'goodbye')).toBe('hello');
    const [applyRequest] = await nextMockArgs(applyHandlerMock);
    expect(applyRequest).toEqual(
      expect.objectContaining({
        clientSecret: '<client-secret>',
        flags: [expect.objectContaining({ flag: 'flags/flag1' })],
        resolveToken: 'xyw=',
      }),
    );
  });
  it('should abort previous requests when context changes', async () => {
    confidence.setContext({ pants: 'yellow' });
    const value = confidence.getFlag('flag1.str', 'goodbye');
    confidence.setContext({ pants: 'blue' });
    await value;

    expect(resolveHandlerMock).toHaveBeenCalledTimes(1);
    expect(resolveHandlerMock).toBeCalledWith(expect.objectContaining({ evaluationContext: { pants: 'blue' } }));
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
