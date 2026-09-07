import { IncrementalSource, RecordingEventType } from './events';

const USER_INTERACTION_SOURCES = new Set<number>([
  IncrementalSource.MouseMove,
  IncrementalSource.MouseInteraction,
  IncrementalSource.Scroll,
  IncrementalSource.Input,
  IncrementalSource.TouchMove,
  IncrementalSource.MediaInteraction,
  IncrementalSource.Drag,
  IncrementalSource.Selection,
]);

type UserInteractionSignal = {
  metricKey?: string;
  tags?: readonly string[];
  plugins?: readonly string[];
};

const USER_INTERACTION_SIGNALS: readonly UserInteractionSignal[] = [
  { metricKey: 'clicks', tags: ['csr:click'] },
  { metricKey: 'inputs', tags: ['csr:input'] },
  { metricKey: 'rageClicks', tags: ['csr:rageClick'] },
  { metricKey: 'deadClicks', tags: ['csr:deadClick'] },
  { metricKey: 'scrollBacks', tags: ['csr:scrollBack'] },
  { metricKey: 'tabUnfocuses', tags: ['csr:tabUnfocus'] },
  {
    metricKey: 'routeChanges',
    tags: ['csr:routeChange'],
    plugins: ['csr:routeChange'],
  },
  { tags: ['csr:formFieldReEdit', 'csr:tabRefocus'] },
];

const USER_INTERACTION_TAGS = new Set(USER_INTERACTION_SIGNALS.flatMap(signal => signal.tags ?? []));

const USER_INTERACTION_PLUGINS = new Set(USER_INTERACTION_SIGNALS.flatMap(signal => signal.plugins ?? []));

const USER_INTERACTION_METRIC_KEYS = new Set(
  USER_INTERACTION_SIGNALS.flatMap(signal => (signal.metricKey ? [signal.metricKey] : [])),
);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const isUserInteractionEvent = (event: unknown): boolean => {
  if (!isObject(event) || !isObject(event.data)) {
    return false;
  }

  if (event.type === RecordingEventType.IncrementalSnapshot) {
    return typeof event.data.source === 'number' && USER_INTERACTION_SOURCES.has(event.data.source);
  }

  if (event.type === RecordingEventType.Custom) {
    return typeof event.data.tag === 'string' && USER_INTERACTION_TAGS.has(event.data.tag);
  }

  return (
    event.type === RecordingEventType.Plugin &&
    typeof event.data.plugin === 'string' &&
    USER_INTERACTION_PLUGINS.has(event.data.plugin)
  );
};

export const isUserInteractionMetric = (metricKey: string): boolean => USER_INTERACTION_METRIC_KEYS.has(metricKey);

export const isSessionActivityEvent = (event: unknown): boolean =>
  (isObject(event) && event.type === RecordingEventType.Meta) || isUserInteractionEvent(event);
