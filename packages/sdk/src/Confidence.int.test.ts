import { Confidence } from './Confidence';
import { abortableSleep } from './fetch-util';
import {
  LibraryTraces_Library,
  LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode,
  LibraryTraces_Trace_EvaluationTrace_EvaluationReason,
  LibraryTraces_TraceId,
  Monitoring,
} from './generated/confidence/telemetry/v1/telemetry';

const mockResolveResponse = {
  resolvedFlags: [
    {
      flag: 'flags/flag1',
      variant: 'treatment',
      value: { str: 'hello' },
      flagSchema: { schema: { str: { stringSchema: {} } } },
      reason: 'RESOLVE_REASON_MATCH',
      shouldApply: true,
    },
    {
      flag: 'flags/flag2',
      variant: 'treatment',
      value: { str: 'hello again' },
      flagSchema: { schema: { str: { stringSchema: {} } } },
      reason: 'RESOLVE_REASON_MATCH',
      shouldApply: false,
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
const capturedResolveRequests: Request[] = [];

const fetchImplementation = async (request: Request): Promise<Response> => {
  await abortableSleep(10, request.signal);

  let handler: (reqBody: any) => any;
  switch (request.url) {
    case 'https://custom.dev/v1/flags:resolve':
    case 'https://resolver.confidence.dev/v1/flags:resolve':
      capturedResolveRequests.push(request);
      handler = resolveHandlerMock;
      break;
    case 'https://custom-apply.dev/v1/flags:apply':
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
    capturedResolveRequests.length = 0;
  });

  it('should resolve against provided base url', async () => {
    const customConfidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
      resolveBaseUrl: 'https://custom.dev',
    });

    expect(await customConfidence.getFlag('flag1.str', 'goodbye')).toBe('hello');
  });

  it('should apply against provided apply base url', async () => {
    const customConfidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
      applyBaseUrl: 'https://custom-apply.dev',
    });

    expect(await customConfidence.getFlag('flag1.str', 'goodbye')).toBe('hello');
    const [applyRequest] = await nextMockArgs(applyHandlerMock);
    expect(applyRequest).toEqual(
      expect.objectContaining({
        clientSecret: '<client-secret>',
        flags: [expect.objectContaining({ flag: 'flags/flag1' })],
      }),
    );
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
  it('should resolve a value but not send apply if shouldApply is false', async () => {
    expect(await confidence.getFlag('flag2.str', 'goodbye')).toBe('hello again');
    expect(applyHandlerMock).not.toHaveBeenCalled();
  });
  it('should resolve an integer value from a flag with intSchema', async () => {
    resolveHandlerMock.mockReturnValue({
      resolvedFlags: [
        {
          flag: 'flags/test-flag',
          variant: 'flags/test-flag/variants/variant-1',
          value: {
            myinteger: 400.0,
          },
          flagSchema: {
            schema: {
              myinteger: {
                intSchema: {},
              },
            },
          },
          reason: 'RESOLVE_REASON_MATCH',
          shouldApply: true,
        },
      ],
      resolveToken: 'token1',
    });

    expect(await confidence.getFlag('test-flag.myinteger', 0)).toBe(400);
  });

  it('should send evaluation trace with TARGETING_MATCH reason on successful evaluation', async () => {
    await confidence.getFlag('flag1.str', 'goodbye');
    // trigger a new resolve by changing context
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_TARGETING_MATCH,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_UNSPECIFIED,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with TYPE_MISMATCH on type mismatch', async () => {
    // resolve flags first so we have a non-stale state
    await confidence.getFlag('flag1.str', 'goodbye');
    // flag1.str is a string, evaluating with a number default triggers TYPE_MISMATCH
    confidence.evaluateFlag('flag1.str', 123);
    // trigger a new resolve to flush telemetry
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_ERROR,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_TYPE_MISMATCH,
          },
        }),
      ]),
    );
  });

  it('should send stale flag trace when evaluating with stale context', async () => {
    await confidence.getFlag('flag1.str', 'goodbye');
    // change context to make the cached flags stale
    confidence.setContext({ pants: 'yellow' });
    // evaluate synchronously while context is stale
    confidence.evaluateFlag('flag1.str', 'goodbye');
    // wait for the new resolve to complete (it carries the telemetry)
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const staleTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_STALE_FLAG),
    );
    expect(staleTraces).toBeDefined();
  });

  it('should send evaluation trace with FLAG_NOT_FOUND for unknown flags', async () => {
    // resolve flags first so we have a non-stale state
    await confidence.getFlag('flag1.str', 'goodbye');
    // evaluate a flag that doesn't exist
    confidence.evaluateFlag('unknown-flag.str', 'default');
    // trigger new resolve to flush telemetry
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_ERROR,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_FLAG_NOT_FOUND,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with DISABLED reason for archived flags', async () => {
    const archivedResponse = {
      resolvedFlags: [
        {
          flag: 'flags/flag1',
          variant: '',
          value: {},
          flagSchema: { schema: { str: { stringSchema: {} } } },
          reason: 'RESOLVE_REASON_FLAG_ARCHIVED',
          shouldApply: false,
        },
      ],
      resolveToken: 'xyz',
    };
    resolveHandlerMock.mockReturnValue(archivedResponse);
    await confidence.getFlag('flag1.str', 'goodbye');
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_DISABLED,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_UNSPECIFIED,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with TARGETING_KEY_MISSING for targeting key errors', async () => {
    const targetingKeyErrorResponse = {
      resolvedFlags: [
        {
          flag: 'flags/flag1',
          variant: '',
          value: {},
          flagSchema: { schema: { str: { stringSchema: {} } } },
          reason: 'RESOLVE_REASON_TARGETING_KEY_ERROR',
          shouldApply: false,
        },
      ],
      resolveToken: 'xyz',
    };
    resolveHandlerMock.mockReturnValue(targetingKeyErrorResponse);
    await confidence.getFlag('flag1.str', 'goodbye');
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_ERROR,
            errorCode:
              LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_TARGETING_KEY_MISSING,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with DEFAULT reason for no-segment-match', async () => {
    const noSegmentMatchResponse = {
      resolvedFlags: [
        {
          flag: 'flags/flag1',
          variant: '',
          value: {},
          flagSchema: { schema: { str: { stringSchema: {} } } },
          reason: 'RESOLVE_REASON_NO_SEGMENT_MATCH',
          shouldApply: false,
        },
      ],
      resolveToken: 'xyz',
    };
    resolveHandlerMock.mockReturnValue(noSegmentMatchResponse);
    await confidence.getFlag('flag1.str', 'goodbye');
    confidence.setContext({ pants: 'yellow' });
    await confidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.traces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION,
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_DEFAULT,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_UNSPECIFIED,
          },
        }),
      ]),
    );
  });

  it('should tag telemetry as LIBRARY_OPEN_FEATURE when library option is openfeature', async () => {
    const ofConfidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
      library: 'openfeature',
    });
    await ofConfidence.getFlag('flag1.str', 'goodbye');
    ofConfidence.setContext({ pants: 'yellow' });
    await ofConfidence.getFlag('flag1.str', 'goodbye');

    const telemetry = decodeTelemetryHeader(capturedResolveRequests[1]);
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.library).toBe(LibraryTraces_Library.LIBRARY_OPEN_FEATURE);
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

function decodeTelemetryHeader(request: Request): Monitoring | undefined {
  const header = request.headers.get('X-CONFIDENCE-TELEMETRY');
  if (!header) return undefined;
  const bytes = Uint8Array.from(atob(header), c => c.charCodeAt(0));
  return Monitoring.decode(bytes);
}

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
