// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v2.3.0
//   protoc               v3.21.8
// source: confidence/telemetry/v1/telemetry.proto

/* eslint-disable */
import { BinaryReader, BinaryWriter } from '@bufbuild/protobuf/wire';

export const protobufPackage = 'confidence.telemetry.v1';

export enum Platform {
  PLATFORM_UNSPECIFIED = 0,
  PLATFORM_JS_WEB = 4,
  PLATFORM_JS_SERVER = 5,
  UNRECOGNIZED = -1,
}

export function platformFromJSON(object: any): Platform {
  switch (object) {
    case 0:
    case 'PLATFORM_UNSPECIFIED':
      return Platform.PLATFORM_UNSPECIFIED;
    case 4:
    case 'PLATFORM_JS_WEB':
      return Platform.PLATFORM_JS_WEB;
    case 5:
    case 'PLATFORM_JS_SERVER':
      return Platform.PLATFORM_JS_SERVER;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return Platform.UNRECOGNIZED;
  }
}

export function platformToJSON(object: Platform): string {
  switch (object) {
    case Platform.PLATFORM_UNSPECIFIED:
      return 'PLATFORM_UNSPECIFIED';
    case Platform.PLATFORM_JS_WEB:
      return 'PLATFORM_JS_WEB';
    case Platform.PLATFORM_JS_SERVER:
      return 'PLATFORM_JS_SERVER';
    case Platform.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

export interface Monitoring {
  libraryTraces: LibraryTraces[];
  platform: Platform;
}

export interface LibraryTraces {
  library: LibraryTraces_Library;
  libraryVersion: string;
  traces: LibraryTraces_Trace[];
}

export enum LibraryTraces_Library {
  LIBRARY_UNSPECIFIED = 0,
  LIBRARY_CONFIDENCE = 1,
  LIBRARY_OPEN_FEATURE = 2,
  LIBRARY_REACT = 3,
  UNRECOGNIZED = -1,
}

export function libraryTraces_LibraryFromJSON(object: any): LibraryTraces_Library {
  switch (object) {
    case 0:
    case 'LIBRARY_UNSPECIFIED':
      return LibraryTraces_Library.LIBRARY_UNSPECIFIED;
    case 1:
    case 'LIBRARY_CONFIDENCE':
      return LibraryTraces_Library.LIBRARY_CONFIDENCE;
    case 2:
    case 'LIBRARY_OPEN_FEATURE':
      return LibraryTraces_Library.LIBRARY_OPEN_FEATURE;
    case 3:
    case 'LIBRARY_REACT':
      return LibraryTraces_Library.LIBRARY_REACT;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return LibraryTraces_Library.UNRECOGNIZED;
  }
}

export function libraryTraces_LibraryToJSON(object: LibraryTraces_Library): string {
  switch (object) {
    case LibraryTraces_Library.LIBRARY_UNSPECIFIED:
      return 'LIBRARY_UNSPECIFIED';
    case LibraryTraces_Library.LIBRARY_CONFIDENCE:
      return 'LIBRARY_CONFIDENCE';
    case LibraryTraces_Library.LIBRARY_OPEN_FEATURE:
      return 'LIBRARY_OPEN_FEATURE';
    case LibraryTraces_Library.LIBRARY_REACT:
      return 'LIBRARY_REACT';
    case LibraryTraces_Library.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

export enum LibraryTraces_TraceId {
  TRACE_ID_UNSPECIFIED = 0,
  TRACE_ID_RESOLVE_LATENCY = 1,
  TRACE_ID_STALE_FLAG = 2,
  TRACE_ID_FLAG_TYPE_MISMATCH = 3,
  TRACE_ID_WITH_CONTEXT = 4,
  UNRECOGNIZED = -1,
}

export function libraryTraces_TraceIdFromJSON(object: any): LibraryTraces_TraceId {
  switch (object) {
    case 0:
    case 'TRACE_ID_UNSPECIFIED':
      return LibraryTraces_TraceId.TRACE_ID_UNSPECIFIED;
    case 1:
    case 'TRACE_ID_RESOLVE_LATENCY':
      return LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY;
    case 2:
    case 'TRACE_ID_STALE_FLAG':
      return LibraryTraces_TraceId.TRACE_ID_STALE_FLAG;
    case 3:
    case 'TRACE_ID_FLAG_TYPE_MISMATCH':
      return LibraryTraces_TraceId.TRACE_ID_FLAG_TYPE_MISMATCH;
    case 4:
    case 'TRACE_ID_WITH_CONTEXT':
      return LibraryTraces_TraceId.TRACE_ID_WITH_CONTEXT;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return LibraryTraces_TraceId.UNRECOGNIZED;
  }
}

export function libraryTraces_TraceIdToJSON(object: LibraryTraces_TraceId): string {
  switch (object) {
    case LibraryTraces_TraceId.TRACE_ID_UNSPECIFIED:
      return 'TRACE_ID_UNSPECIFIED';
    case LibraryTraces_TraceId.TRACE_ID_RESOLVE_LATENCY:
      return 'TRACE_ID_RESOLVE_LATENCY';
    case LibraryTraces_TraceId.TRACE_ID_STALE_FLAG:
      return 'TRACE_ID_STALE_FLAG';
    case LibraryTraces_TraceId.TRACE_ID_FLAG_TYPE_MISMATCH:
      return 'TRACE_ID_FLAG_TYPE_MISMATCH';
    case LibraryTraces_TraceId.TRACE_ID_WITH_CONTEXT:
      return 'TRACE_ID_WITH_CONTEXT';
    case LibraryTraces_TraceId.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

export interface LibraryTraces_Trace {
  id: LibraryTraces_TraceId;
  /** DEPRECATED */
  millisecondDuration?: number | undefined;
  requestTrace?: LibraryTraces_Trace_RequestTrace | undefined;
  countTrace?: LibraryTraces_Trace_CountTrace | undefined;
}

export interface LibraryTraces_Trace_CountTrace {}

export interface LibraryTraces_Trace_RequestTrace {
  millisecondDuration: number;
  status: LibraryTraces_Trace_RequestTrace_Status;
}

export enum LibraryTraces_Trace_RequestTrace_Status {
  STATUS_UNSPECIFIED = 0,
  STATUS_SUCCESS = 1,
  STATUS_ERROR = 2,
  STATUS_TIMEOUT = 3,
  STATUS_CACHED = 4,
  UNRECOGNIZED = -1,
}

export function libraryTraces_Trace_RequestTrace_StatusFromJSON(object: any): LibraryTraces_Trace_RequestTrace_Status {
  switch (object) {
    case 0:
    case 'STATUS_UNSPECIFIED':
      return LibraryTraces_Trace_RequestTrace_Status.STATUS_UNSPECIFIED;
    case 1:
    case 'STATUS_SUCCESS':
      return LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS;
    case 2:
    case 'STATUS_ERROR':
      return LibraryTraces_Trace_RequestTrace_Status.STATUS_ERROR;
    case 3:
    case 'STATUS_TIMEOUT':
      return LibraryTraces_Trace_RequestTrace_Status.STATUS_TIMEOUT;
    case 4:
    case 'STATUS_CACHED':
      return LibraryTraces_Trace_RequestTrace_Status.STATUS_CACHED;
    case -1:
    case 'UNRECOGNIZED':
    default:
      return LibraryTraces_Trace_RequestTrace_Status.UNRECOGNIZED;
  }
}

export function libraryTraces_Trace_RequestTrace_StatusToJSON(object: LibraryTraces_Trace_RequestTrace_Status): string {
  switch (object) {
    case LibraryTraces_Trace_RequestTrace_Status.STATUS_UNSPECIFIED:
      return 'STATUS_UNSPECIFIED';
    case LibraryTraces_Trace_RequestTrace_Status.STATUS_SUCCESS:
      return 'STATUS_SUCCESS';
    case LibraryTraces_Trace_RequestTrace_Status.STATUS_ERROR:
      return 'STATUS_ERROR';
    case LibraryTraces_Trace_RequestTrace_Status.STATUS_TIMEOUT:
      return 'STATUS_TIMEOUT';
    case LibraryTraces_Trace_RequestTrace_Status.STATUS_CACHED:
      return 'STATUS_CACHED';
    case LibraryTraces_Trace_RequestTrace_Status.UNRECOGNIZED:
    default:
      return 'UNRECOGNIZED';
  }
}

function createBaseMonitoring(): Monitoring {
  return { libraryTraces: [], platform: 0 };
}

export const Monitoring: MessageFns<Monitoring> = {
  encode(message: Monitoring, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    for (const v of message.libraryTraces) {
      LibraryTraces.encode(v!, writer.uint32(10).fork()).join();
    }
    if (message.platform !== 0) {
      writer.uint32(16).int32(message.platform);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): Monitoring {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMonitoring();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 10) {
            break;
          }

          message.libraryTraces.push(LibraryTraces.decode(reader, reader.uint32()));
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }

          message.platform = reader.int32() as any;
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): Monitoring {
    return {
      libraryTraces: globalThis.Array.isArray(object?.libraryTraces)
        ? object.libraryTraces.map((e: any) => LibraryTraces.fromJSON(e))
        : [],
      platform: isSet(object.platform) ? platformFromJSON(object.platform) : 0,
    };
  },

  toJSON(message: Monitoring): unknown {
    const obj: any = {};
    if (message.libraryTraces?.length) {
      obj.libraryTraces = message.libraryTraces.map(e => LibraryTraces.toJSON(e));
    }
    if (message.platform !== 0) {
      obj.platform = platformToJSON(message.platform);
    }
    return obj;
  },
};

function createBaseLibraryTraces(): LibraryTraces {
  return { library: 0, libraryVersion: '', traces: [] };
}

export const LibraryTraces: MessageFns<LibraryTraces> = {
  encode(message: LibraryTraces, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.library !== 0) {
      writer.uint32(8).int32(message.library);
    }
    if (message.libraryVersion !== '') {
      writer.uint32(18).string(message.libraryVersion);
    }
    for (const v of message.traces) {
      LibraryTraces_Trace.encode(v!, writer.uint32(26).fork()).join();
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): LibraryTraces {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLibraryTraces();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }

          message.library = reader.int32() as any;
          continue;
        }
        case 2: {
          if (tag !== 18) {
            break;
          }

          message.libraryVersion = reader.string();
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }

          message.traces.push(LibraryTraces_Trace.decode(reader, reader.uint32()));
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): LibraryTraces {
    return {
      library: isSet(object.library) ? libraryTraces_LibraryFromJSON(object.library) : 0,
      libraryVersion: isSet(object.libraryVersion) ? globalThis.String(object.libraryVersion) : '',
      traces: globalThis.Array.isArray(object?.traces)
        ? object.traces.map((e: any) => LibraryTraces_Trace.fromJSON(e))
        : [],
    };
  },

  toJSON(message: LibraryTraces): unknown {
    const obj: any = {};
    if (message.library !== 0) {
      obj.library = libraryTraces_LibraryToJSON(message.library);
    }
    if (message.libraryVersion !== '') {
      obj.libraryVersion = message.libraryVersion;
    }
    if (message.traces?.length) {
      obj.traces = message.traces.map(e => LibraryTraces_Trace.toJSON(e));
    }
    return obj;
  },
};

function createBaseLibraryTraces_Trace(): LibraryTraces_Trace {
  return { id: 0, millisecondDuration: undefined, requestTrace: undefined, countTrace: undefined };
}

export const LibraryTraces_Trace: MessageFns<LibraryTraces_Trace> = {
  encode(message: LibraryTraces_Trace, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    if (message.millisecondDuration !== undefined) {
      writer.uint32(16).uint64(message.millisecondDuration);
    }
    if (message.requestTrace !== undefined) {
      LibraryTraces_Trace_RequestTrace.encode(message.requestTrace, writer.uint32(26).fork()).join();
    }
    if (message.countTrace !== undefined) {
      LibraryTraces_Trace_CountTrace.encode(message.countTrace, writer.uint32(34).fork()).join();
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): LibraryTraces_Trace {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLibraryTraces_Trace();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32() as any;
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }

          message.millisecondDuration = longToNumber(reader.uint64());
          continue;
        }
        case 3: {
          if (tag !== 26) {
            break;
          }

          message.requestTrace = LibraryTraces_Trace_RequestTrace.decode(reader, reader.uint32());
          continue;
        }
        case 4: {
          if (tag !== 34) {
            break;
          }

          message.countTrace = LibraryTraces_Trace_CountTrace.decode(reader, reader.uint32());
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): LibraryTraces_Trace {
    return {
      id: isSet(object.id) ? libraryTraces_TraceIdFromJSON(object.id) : 0,
      millisecondDuration: isSet(object.millisecondDuration)
        ? globalThis.Number(object.millisecondDuration)
        : undefined,
      requestTrace: isSet(object.requestTrace)
        ? LibraryTraces_Trace_RequestTrace.fromJSON(object.requestTrace)
        : undefined,
      countTrace: isSet(object.countTrace) ? LibraryTraces_Trace_CountTrace.fromJSON(object.countTrace) : undefined,
    };
  },

  toJSON(message: LibraryTraces_Trace): unknown {
    const obj: any = {};
    if (message.id !== 0) {
      obj.id = libraryTraces_TraceIdToJSON(message.id);
    }
    if (message.millisecondDuration !== undefined) {
      obj.millisecondDuration = Math.round(message.millisecondDuration);
    }
    if (message.requestTrace !== undefined) {
      obj.requestTrace = LibraryTraces_Trace_RequestTrace.toJSON(message.requestTrace);
    }
    if (message.countTrace !== undefined) {
      obj.countTrace = LibraryTraces_Trace_CountTrace.toJSON(message.countTrace);
    }
    return obj;
  },
};

function createBaseLibraryTraces_Trace_CountTrace(): LibraryTraces_Trace_CountTrace {
  return {};
}

export const LibraryTraces_Trace_CountTrace: MessageFns<LibraryTraces_Trace_CountTrace> = {
  encode(_: LibraryTraces_Trace_CountTrace, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): LibraryTraces_Trace_CountTrace {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLibraryTraces_Trace_CountTrace();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(_: any): LibraryTraces_Trace_CountTrace {
    return {};
  },

  toJSON(_: LibraryTraces_Trace_CountTrace): unknown {
    const obj: any = {};
    return obj;
  },
};

function createBaseLibraryTraces_Trace_RequestTrace(): LibraryTraces_Trace_RequestTrace {
  return { millisecondDuration: 0, status: 0 };
}

export const LibraryTraces_Trace_RequestTrace: MessageFns<LibraryTraces_Trace_RequestTrace> = {
  encode(message: LibraryTraces_Trace_RequestTrace, writer: BinaryWriter = new BinaryWriter()): BinaryWriter {
    if (message.millisecondDuration !== 0) {
      writer.uint32(8).uint64(message.millisecondDuration);
    }
    if (message.status !== 0) {
      writer.uint32(16).int32(message.status);
    }
    return writer;
  },

  decode(input: BinaryReader | Uint8Array, length?: number): LibraryTraces_Trace_RequestTrace {
    const reader = input instanceof BinaryReader ? input : new BinaryReader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseLibraryTraces_Trace_RequestTrace();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1: {
          if (tag !== 8) {
            break;
          }

          message.millisecondDuration = longToNumber(reader.uint64());
          continue;
        }
        case 2: {
          if (tag !== 16) {
            break;
          }

          message.status = reader.int32() as any;
          continue;
        }
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skip(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): LibraryTraces_Trace_RequestTrace {
    return {
      millisecondDuration: isSet(object.millisecondDuration) ? globalThis.Number(object.millisecondDuration) : 0,
      status: isSet(object.status) ? libraryTraces_Trace_RequestTrace_StatusFromJSON(object.status) : 0,
    };
  },

  toJSON(message: LibraryTraces_Trace_RequestTrace): unknown {
    const obj: any = {};
    if (message.millisecondDuration !== 0) {
      obj.millisecondDuration = Math.round(message.millisecondDuration);
    }
    if (message.status !== 0) {
      obj.status = libraryTraces_Trace_RequestTrace_StatusToJSON(message.status);
    }
    return obj;
  },
};

function longToNumber(int64: { toString(): string }): number {
  const num = globalThis.Number(int64.toString());
  if (num > globalThis.Number.MAX_SAFE_INTEGER) {
    throw new globalThis.Error('Value is larger than Number.MAX_SAFE_INTEGER');
  }
  if (num < globalThis.Number.MIN_SAFE_INTEGER) {
    throw new globalThis.Error('Value is smaller than Number.MIN_SAFE_INTEGER');
  }
  return num;
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export interface MessageFns<T> {
  encode(message: T, writer?: BinaryWriter): BinaryWriter;
  decode(input: BinaryReader | Uint8Array, length?: number): T;
  fromJSON(object: any): T;
  toJSON(message: T): unknown;
}
