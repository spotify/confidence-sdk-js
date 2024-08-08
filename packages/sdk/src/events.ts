import { Value } from './Value';
import { Contextual } from './context';

/**
 * Event data
 * @public
 */
export type EventData = Value.Struct & { context?: never };

/**
 * EventSender interface
 * @public
 */
export interface EventSender extends Contextual<EventSender> {
  /**
   * Tracks an event
   * @param name - event name
   * @param data - data to track */
  track(name: string, data?: EventData): void;
}
