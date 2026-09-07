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

const USER_INTERACTION_TAGS = new Set([
  'csr:click',
  'csr:deadClick',
  'csr:rageClick',
  'csr:input',
  'csr:formFieldReEdit',
  'csr:scrollBack',
  'csr:routeChange',
  'csr:tabRefocus',
]);

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

  return event.type === RecordingEventType.Plugin && event.data.plugin === 'csr:routeChange';
};

export const isSessionActivityEvent = (event: unknown): boolean =>
  (isObject(event) && event.type === RecordingEventType.Meta) || isUserInteractionEvent(event);
