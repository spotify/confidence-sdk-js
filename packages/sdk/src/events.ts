import { Value } from './Value';
import { Contextual, LazyContext } from './context';

export const kContext = Symbol('Context');
export interface Event {
  [eventName: string]: Value.Struct | undefined;
  [kContext]?: LazyContext;
}
export type EventProducer = AsyncIterable<Event>;

export interface EventSender extends Contextual<EventSender> {
  sendEvent(name: string, message?: Value.Struct): void;
  track(producer: EventProducer): void;
}

export function createProducer(executor: (emit: (event?: Event) => void) => void): EventProducer {
  let closed = false;
  let wakeUp: (() => void) | undefined;
  const queue: Event[] = [];

  const emit = (event?: Event) => {
    if (closed) throw new Error('Producer closed');
    if (!event) {
      closed = true;
    } else {
      queue.push(event);
    }
    wakeUp?.();
  };

  async function* producer(): AsyncIterable<Event> {
    try {
      executor(emit);
      while (!closed) {
        while (queue.length) {
          yield queue.pop()!;
        }
        await new Promise<void>(resolve => {
          wakeUp = resolve;
        });
        wakeUp = undefined;
      }
    } finally {
      closed = true;
      queue.length = 0;
    }
  }

  return producer();
}
