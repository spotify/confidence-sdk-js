import { describe, expect, it } from 'vitest';
import { IncrementalSource, RecordingEventType } from './events';
import { isSessionActivityEvent, isUserInteractionEvent } from './session-activity';

describe('session activity', () => {
  it.each([
    {
      type: RecordingEventType.IncrementalSnapshot,
      data: { source: IncrementalSource.MouseMove },
    },
    {
      type: RecordingEventType.IncrementalSnapshot,
      data: { source: IncrementalSource.MouseInteraction },
    },
    {
      type: RecordingEventType.Custom,
      data: { tag: 'csr:input' },
    },
    {
      type: RecordingEventType.Plugin,
      data: { plugin: 'csr:routeChange' },
    },
  ])('identifies user interaction events', event => {
    expect(isUserInteractionEvent(event)).toBe(true);
  });

  it.each([
    {
      type: RecordingEventType.IncrementalSnapshot,
      data: { source: IncrementalSource.Mutation },
    },
    {
      type: RecordingEventType.Plugin,
      data: { plugin: 'csr:networkRequest' },
    },
    null,
    {},
  ])('ignores passive and malformed events', event => {
    expect(isUserInteractionEvent(event)).toBe(false);
  });

  it('treats page metadata as session activity without treating it as an interaction', () => {
    const event = { type: RecordingEventType.Meta, data: {} };

    expect(isUserInteractionEvent(event)).toBe(false);
    expect(isSessionActivityEvent(event)).toBe(true);
  });
});
