/**
 * Mirrors rrweb's serialized-node types but decoupled — we own the enum.
 */
export enum SerializedNodeType {
  Document = 0,
  DocumentType = 1,
  Element = 2,
  Text = 3,
  CDATA = 4,
  Comment = 5,
}

/**
 * Mirrors rrweb event types but decoupled — we own the enum.
 */
export enum RecordingEventType {
  DomContentLoaded = 0,
  Load = 1,
  FullSnapshot = 2,
  IncrementalSnapshot = 3,
  Meta = 4,
  Custom = 5,
  Plugin = 6,
}

/**
 * Incremental snapshot sub-types.
 */
export enum IncrementalSource {
  Mutation = 0,
  MouseMove = 1,
  MouseInteraction = 2,
  Scroll = 3,
  ViewportResize = 4,
  Input = 5,
  TouchMove = 6,
  MediaInteraction = 7,
  StyleSheetRule = 8,
  CanvasMutation = 9,
  Font = 10,
  Log = 11,
  Drag = 12,
  StyleDeclaration = 13,
  Selection = 14,
  AdoptedStyleSheet = 15,
}

/**
 * From rrweb MouseInteractions.
 */
export enum MouseInteractions {
  MouseUp = 0,
  MouseDown = 1,
  Click = 2,
  ContextMenu = 3,
  DblClick = 4,
  Focus = 5,
  Blur = 6,
  TouchStart = 7,
  TouchMove_Departed = 8,
  TouchEnd = 9,
  TouchCancel = 10,
}

/**
 * Incremental mouse-interaction data emitted by rrweb.
 */
export type MouseInteractionData = {
  source: IncrementalSource.MouseInteraction;
  type: MouseInteractions;
  id: number;
  x?: number;
  y?: number;
  pointerType?: number;
};

export type SelectionRange = {
  start: number;
  startOffset: number;
  end: number;
  endOffset: number;
};

/**
 * Incremental text-selection data emitted by rrweb.
 */
export type SelectionData = {
  source: IncrementalSource.Selection;
  ranges: SelectionRange[];
};

/**
 * Incremental sources that csr-common does not model yet. The source remains
 * discriminated so consumers can narrow the known mouse and selection shapes.
 */
export type OpaqueIncrementalData = {
  source: Exclude<IncrementalSource, IncrementalSource.MouseInteraction | IncrementalSource.Selection>;
  [key: string]: unknown;
};

export type IncrementalSnapshotData = MouseInteractionData | SelectionData | OpaqueIncrementalData;

export type RageClickCustomData = {
  tag: 'csr:rageClick';
  payload: {
    eventId?: string;
    targetId: number;
    clickCount: number;
    durationMs: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type FormFieldReEditCustomData = {
  tag: 'csr:formFieldReEdit';
  payload: {
    eventId?: string;
    targetId: number;
    editCount: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type ScrollBackCustomData = {
  tag: 'csr:scrollBack';
  payload: {
    eventId?: string;
    scrollBackPx: number;
    fromY: number;
    toY: number;
    pathname?: string;
  };
};

export type ElementDescriptor = {
  tagName: string;
  classes?: string[];
  textContent?: string;
  attributes?: Record<string, string>;
};

export type ClickCustomData = {
  tag: 'csr:click';
  payload: {
    eventId?: string;
    targetId: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type InputCustomData = {
  tag: 'csr:input';
  payload: {
    eventId?: string;
    targetId: number;
    element?: ElementDescriptor;
    pathname?: string;
    fieldType?: string;
    hasValue?: boolean;
  };
};

export type DeadClickCustomData = {
  tag: 'csr:deadClick';
  payload: {
    eventId?: string;
    targetId: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type TabUnfocusCustomData = {
  tag: 'csr:tabUnfocus';
  payload: {
    eventId?: string;
    pathname?: string;
  };
};

export type TabRefocusCustomData = {
  tag: 'csr:tabRefocus';
  payload: {
    eventId?: string;
    awayDurationMs: number;
    pathname?: string;
  };
};

export type RouteChangeTrigger = 'pushState' | 'replaceState' | 'popstate' | 'navigation';

export type RouteChangePayload = {
  from: string;
  to: string;
  trigger: RouteChangeTrigger;
};

export type RouteChangeCustomData = {
  tag: 'csr:routeChange';
  // Intersected rather than added to RouteChangePayload so the plugin-event
  // shape (RouteChangePluginData) stays free of analyzer identity.
  payload: RouteChangePayload & { eventId?: string };
};

/**
 * Plugin event data emitted by the recorder for tab visibility changes.
 */
export type TabVisibilityPluginData = {
  plugin: 'csr:tabVisibility';
  payload: { hidden: boolean };
};

export type ConsoleLogLevel = 'log' | 'warn' | 'error' | 'debug' | 'info';

/**
 * Plugin event data emitted by rrweb's console record plugin.
 * Shape matches `@rrweb/rrweb-plugin-console-record` LogData.
 */
export type ConsoleLogPluginData = {
  plugin: 'rrweb/console@1';
  payload: {
    level: ConsoleLogLevel;
    payload: string[];
    trace: string[];
  };
};

export type NetworkRequestInitiator = 'fetch' | 'xhr';

export type GraphQLRequestMetadata = {
  operationName: string;
};

/**
 * Plugin event data emitted by the recorder for network requests.
 */
export type NetworkRequestPluginData = {
  plugin: 'csr:networkRequest';
  payload: {
    initiator: NetworkRequestInitiator;
    method: string;
    url: string;
    status: number;
    durationMs: number;
    requestSize?: number;
    responseSize?: number;
    graphql?: GraphQLRequestMetadata;
  };
};

export type RouteChangePluginData = {
  plugin: 'csr:routeChange';
  payload: RouteChangePayload;
};

export type TagPluginData = {
  plugin: 'csr:tag';
  payload: {
    key: string;
    value?: string;
  };
};

export type MeasurePluginData = {
  plugin: 'csr:measure';
  payload: {
    key: string;
    value?: number;
  };
};

export type FlagEvaluationPluginData = {
  plugin: 'csr:flagEvaluation';
  payload: {
    flagKey: string;
    variant: string;
    assignmentOrigin: string;
  };
};

export type ErrorMessageCustomData = {
  tag: 'csr:errorMessage';
  payload: {
    eventId?: string;
    text: string;
  };
};

export type DialogOpenedCustomData = {
  tag: 'csr:dialogOpened';
  payload: {
    eventId?: string;
    content: string[];
  };
};

export type IdleGapCustomData = {
  tag: 'csr:idleGap';
  payload: {
    eventId?: string;
    visibleGapS: number;
    totalGapS: number;
    hiddenS: number;
    trailing: boolean;
  };
};

export type AwayGapCustomData = {
  tag: 'csr:awayGap';
  payload: {
    eventId?: string;
    totalGapS: number;
    hiddenS: number;
  };
};

/**
 * Closed union of every Custom event we emit. Add a new variant here when
 * introducing a new tag — emitting an unregistered tag is a TS error.
 *
 * Every payload carries an optional `eventId`: a per-event identity stamped
 * at emission by the analyzer (uuid). It is inert metadata — players ignore
 * it — and exists so downstream review tooling can reference and remove
 * individual generated events without patching untyped data.
 */
export type CustomEventData =
  | ClickCustomData
  | InputCustomData
  | RageClickCustomData
  | FormFieldReEditCustomData
  | ScrollBackCustomData
  | DeadClickCustomData
  | TabUnfocusCustomData
  | TabRefocusCustomData
  | RouteChangeCustomData
  | ErrorMessageCustomData
  | DialogOpenedCustomData
  | IdleGapCustomData
  | AwayGapCustomData;

/**
 * A single recorded event.
 *
 * For non-Custom events `data` is `unknown` (decoupled from rrweb internals).
 * For Custom events `data.tag` discriminates the payload across the closed
 * `CustomEventData` union.
 */
export type RecordingEvent =
  | {
      type: RecordingEventType.Custom;
      timestamp: number;
      data: CustomEventData;
    }
  | {
      type: RecordingEventType.IncrementalSnapshot;
      timestamp: number;
      data: IncrementalSnapshotData;
    }
  | {
      type: Exclude<RecordingEventType, RecordingEventType.Custom | RecordingEventType.IncrementalSnapshot>;
      timestamp: number;
      data: unknown;
    };
