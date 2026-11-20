import {
  RecordingEventType,
  RecordingPluginName,
  validateKey,
  validateMeasureValue,
  validateTagValue,
  type FlagEvaluationPluginData,
  type MeasurePluginData,
  type PluginEventData,
  type RecordingEvent,
  type TagPluginData,
} from '@spotify-confidence/csr-common';
import type { FlagWrite } from './flag-observer';

// Shared by the real recorder and local reviews, so a review shows exactly what would be uploaded.

function pluginEvent(data: PluginEventData): RecordingEvent {
  return { type: RecordingEventType.Plugin, timestamp: Date.now(), data };
}

/** A tag event, or undefined (with a debug message) when the key or value is invalid. */
export function tagEvent(key: string, value: string | undefined, debugLogger?: (message: string) => void) {
  const error = validateKey(key) ?? validateTagValue(value);
  if (error) {
    debugLogger?.(`tag() dropped: ${error}`);
    return undefined;
  }
  const data: TagPluginData = {
    plugin: RecordingPluginName.Tag,
    payload: value !== undefined ? { key, value } : { key },
  };
  return pluginEvent(data);
}

/** A measure event, or undefined (with a debug message) when the key or value is invalid. */
export function measureEvent(key: string, value: number | undefined, debugLogger?: (message: string) => void) {
  const error = validateKey(key) ?? validateMeasureValue(value);
  if (error) {
    debugLogger?.(`measure() dropped: ${error}`);
    return undefined;
  }
  const data: MeasurePluginData = {
    plugin: RecordingPluginName.Measure,
    payload: value !== undefined ? { key, value } : { key },
  };
  return pluginEvent(data);
}

export function flagEvaluationEvent({ flagKey, variant, assignmentOrigin }: FlagWrite): RecordingEvent {
  const data: FlagEvaluationPluginData = {
    plugin: RecordingPluginName.FlagEvaluation,
    payload: { flagKey, variant, assignmentOrigin },
  };
  return pluginEvent(data);
}
