import { Value } from './Value';
import { Contextual } from './context';

export interface EventSender extends Contextual<EventSender> {
  track(name: string, data?: Value.Struct): void;
}
