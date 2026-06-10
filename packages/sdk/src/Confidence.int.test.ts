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
const telemetryUploadHandlerMock = jest.fn();

const fetchImplementation = async (request: Request): Promise<Response> => {
  await abortableSleep(10, request.signal);

  let handler: (reqBody: any) => any;
  switch (request.url) {
    case 'https://custom.dev/v1/flags:resolve':
    case 'https://resolver.confidence.dev/v1/flags:resolve':
      handler = resolveHandlerMock;
      break;
    case 'https://custom-apply.dev/v1/flags:apply':
    case 'https://resolver.confidence.dev/v1/flags:apply':
      handler = applyHandlerMock;
      break;
    case 'https://events.confidence.dev/v1/events:publish':
      handler = publishHandlerMock;
      break;
    case 'https://resolver.confidence.dev/v1/telemetry:upload':
      handler = data => telemetryUploadHandlerMock(data);
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
      disableTelemetry: true,
    });

    resolveHandlerMock.mockReturnValue(mockResolveResponse);
    publishHandlerMock.mockReturnValue(mockPublishResponse);
  });

  afterEach(() => {
    resolveHandlerMock.mockClear();
    applyHandlerMock.mockClear();
    publishHandlerMock.mockClear();
    telemetryUploadHandlerMock.mockClear();
  });

  it('should resolve against provided base url', async () => {
    const customConfidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
      resolveBaseUrl: 'https://custom.dev',
      disableTelemetry: true,
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
      disableTelemetry: true,
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

  it('should abort previous requests when context changes', async () => {
    confidence.setContext({ pants: 'yellow' });
    const value = confidence.getFlag('flag1.str', 'goodbye');
    confidence.setContext({ pants: 'blue' });
    await value;

    expect(resolveHandlerMock).toHaveBeenCalledTimes(1);
    expect(resolveHandlerMock).toBeCalledWith(expect.objectContaining({ evaluationContext: { pants: 'blue' } }));
  });
});

describe('Telemetry trace integration tests', () => {
  let confidence: Confidence;

  beforeEach(() => {
    jest.useFakeTimers();
    resolveHandlerMock.mockReturnValue(mockResolveResponse);
    publishHandlerMock.mockReturnValue(mockPublishResponse);
    confidence = Confidence.create({
      clientSecret: '<client-secret>',
      timeout: 100,
      environment: 'client',
      fetchImplementation,
    });
  });

  afterEach(() => {
    resolveHandlerMock.mockClear();
    applyHandlerMock.mockClear();
    publishHandlerMock.mockClear();
    telemetryUploadHandlerMock.mockClear();
    jest.useRealTimers();
  });

  async function resolveAndEvaluate(conf: Confidence, flag: string, defaultValue: any): Promise<void> {
    const promise = conf.getFlag(flag, defaultValue);
    await jest.advanceTimersByTimeAsync(20);
    await promise;
  }

  async function flushTelemetry(conf: Confidence): Promise<void> {
    conf.flushTelemetry();
    await jest.advanceTimersByTimeAsync(20);
  }

  it('should send evaluation trace with TARGETING_MATCH reason', async () => {
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    await flushTelemetry(confidence);

    const telemetry = lastTelemetryUpload();
    expect(telemetry).toBeDefined();
    expect(findTraces(telemetry!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_TARGETING_MATCH,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_UNSPECIFIED,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with TYPE_MISMATCH on type mismatch', async () => {
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    confidence.evaluateFlag('flag1.str', 123);
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_ERROR,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_TYPE_MISMATCH,
          },
        }),
      ]),
    );
  });

  it('should send stale flag trace when evaluating with stale context', async () => {
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    confidence.setContext({ pants: 'yellow' });
    confidence.evaluateFlag('flag1.str', 'goodbye');
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_STALE_FLAG)).not.toHaveLength(0);
  });

  it('should send evaluation trace with FLAG_NOT_FOUND for unknown flags', async () => {
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    confidence.evaluateFlag('unknown-flag.str', 'default');
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_ERROR,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_FLAG_NOT_FOUND,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with DISABLED reason for archived flags', async () => {
    resolveHandlerMock.mockReturnValue({
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
    });
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evaluationTrace: {
            reason: LibraryTraces_Trace_EvaluationTrace_EvaluationReason.EVALUATION_REASON_DISABLED,
            errorCode: LibraryTraces_Trace_EvaluationTrace_EvaluationErrorCode.EVALUATION_ERROR_CODE_UNSPECIFIED,
          },
        }),
      ]),
    );
  });

  it('should send evaluation trace with TARGETING_KEY_MISSING for targeting key errors', async () => {
    resolveHandlerMock.mockReturnValue({
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
    });
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
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
    resolveHandlerMock.mockReturnValue({
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
    });
    await resolveAndEvaluate(confidence, 'flag1.str', 'goodbye');
    await flushTelemetry(confidence);

    expect(findTraces(lastTelemetryUpload()!, LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
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
    await resolveAndEvaluate(ofConfidence, 'flag1.str', 'goodbye');
    await flushTelemetry(ofConfidence);

    const telemetry = lastTelemetryUpload();
    expect(telemetry).toBeDefined();
    const evaluationTraces = telemetry!.libraryTraces.find(lt =>
      lt.traces.some(t => t.id === LibraryTraces_TraceId.TRACE_ID_FLAG_EVALUATION),
    );
    expect(evaluationTraces).toBeDefined();
    expect(evaluationTraces!.library).toBe(LibraryTraces_Library.LIBRARY_OPEN_FEATURE);
  });
});

function findTraces(monitoring: Monitoring, traceId: LibraryTraces_TraceId) {
  return monitoring.libraryTraces.flatMap(lt => lt.traces.filter(t => t.id === traceId));
}

function lastTelemetryUpload(): Monitoring | undefined {
  if (telemetryUploadHandlerMock.mock.calls.length === 0) return undefined;
  const lastCall = telemetryUploadHandlerMock.mock.calls[telemetryUploadHandlerMock.mock.calls.length - 1][0];
  return Monitoring.fromJSON(lastCall.monitoring);
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
