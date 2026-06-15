export {
  SerializedNodeType,
  RecordingEventType,
  IncrementalSource,
  MouseInteractions,
  type RecordingEvent,
  type CustomEventData,
  type ClickCustomData,
  type InputCustomData,
  type RageClickCustomData,
  type FormFieldReEditCustomData,
  type ScrollBackCustomData,
  type DeadClickCustomData,
  type ElementDescriptor,
  type TabUnfocusCustomData,
  type TabRefocusCustomData,
  type TabVisibilityPluginData,
  type ConsoleLogLevel,
  type ConsoleLogPluginData,
  type NetworkRequestInitiator,
  type NetworkRequestPluginData,
  type RouteChangeTrigger,
  type RouteChangePayload,
  type RouteChangeCustomData,
  type RouteChangePluginData,
  type TagPluginData,
  type MeasurePluginData,
} from './events';

export { stripUrl } from './url';

export {
  MAX_KEY_LENGTH,
  MAX_TAG_VALUE_LENGTH,
  MAX_DISTINCT_KEYS,
  MAX_VALUES_PER_KEY,
  validateKey,
  validateTagValue,
  validateMeasureValue,
} from './custom-event-limits';

export { type Frame } from './uploader/types';

export { type ClientContext, type UserAgentContext } from './uploader/client-context';
