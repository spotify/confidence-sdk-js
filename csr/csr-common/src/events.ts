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

export type RageClickCustomData = {
  tag: 'csr:rageClick';
  payload: {
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
    targetId: number;
    editCount: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type ScrollBackCustomData = {
  tag: 'csr:scrollBack';
  payload: {
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
    targetId: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type InputCustomData = {
  tag: 'csr:input';
  payload: {
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
    targetId: number;
    element?: ElementDescriptor;
    pathname?: string;
  };
};

export type TabUnfocusCustomData = {
  tag: 'csr:tabUnfocus';
  payload: {
    pathname?: string;
  };
};

export type TabRefocusCustomData = {
  tag: 'csr:tabRefocus';
  payload: {
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
  payload: RouteChangePayload;
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
  };
};

export type ErrorMessageCustomData = {
  tag: 'csr:errorMessage';
  payload: {
    text: string;
  };
};

export type DialogOpenedCustomData = {
  tag: 'csr:dialogOpened';
  payload: {
    content: string[];
  };
};

export type IdleGapCustomData = {
  tag: 'csr:idleGap';
  payload: {
    visibleGapS: number;
    totalGapS: number;
    hiddenS: number;
    trailing: boolean;
  };
};

export type AwayGapCustomData = {
  tag: 'csr:awayGap';
  payload: {
    totalGapS: number;
    hiddenS: number;
  };
};

/**
 * Closed union of every Custom event we emit. Add a new variant here when
 * introducing a new tag — emitting an unregistered tag is a TS error.
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
      type: Exclude<RecordingEventType, RecordingEventType.Custom>;
      timestamp: number;
      data: unknown;
    };
