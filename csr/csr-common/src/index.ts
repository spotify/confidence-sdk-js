export {
  SerializedNodeType,
  RecordingEventType,
  RecordingCustomEventTag,
  RecordingPluginName,
  IncrementalSource,
  MouseInteractions,
  type RecordingEvent,
  type PluginEventData,
  type IncrementalSnapshotData,
  type MouseInteractionData,
  type OpaqueIncrementalData,
  type SelectionData,
  type SelectionRange,
  type CustomEventData,
  type ClickCustomData,
  type InputCustomData,
  type ClipboardAction,
  type ClipboardPluginData,
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
  type GraphQLRequestMetadata,
  type NetworkRequestPluginData,
  type RouteChangeTrigger,
  type RouteChangePayload,
  type RouteChangeCustomData,
  type RouteChangePluginData,
  type ErrorMessageCustomData,
  type DialogOpenedCustomData,
  type IdleGapCustomData,
  type AwayGapCustomData,
  type TagPluginData,
  type MeasurePluginData,
  type FlagEvaluationPluginData,
} from './events';

export { stripUrl } from './url';

export { RecordingMetricKey } from './metrics';

export { isSessionActivityEvent, isUserInteractionEvent, isUserInteractionMetric } from './session-activity';

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
