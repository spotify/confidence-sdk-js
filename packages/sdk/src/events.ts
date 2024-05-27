import { Value } from './Value';
import { Contextual } from './context';

export type EventData = Value.Struct & { context?: never };

export interface EventSender extends Contextual<EventSender> {
  track(name: string, data?: EventData): void;
}
