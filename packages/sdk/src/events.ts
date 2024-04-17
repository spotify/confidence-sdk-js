import { Confidence } from './Confidence';
import { Value } from './Value';
import { Contextual } from './context';

export namespace Destructor {
  export function combine(...destructors: Destructor[]): Destructor {
    return () => {
      for (const destructor of destructors) {
        try {
          destructor();
        } catch (e) {
          // TODO log errors
        }
      }
    };
  }
}
export type Destructor = () => void;
export type EventProducer = (confidence: Confidence) => void | Destructor;

export interface EventSender extends Contextual<EventSender> {
  sendEvent(name: string, message?: Value.Struct): void;
  track(producer: EventProducer): void;
}
