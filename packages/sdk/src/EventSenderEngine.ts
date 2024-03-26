import { Value } from './Value';

export class EventSenderEngine {
  send(name: string, message: Value.Struct | undefined, context: Value.Struct): void {
    // eslint-disable-next-line no-console
    console.log('EventSenderEngine.send:', name, message, context);
  }
}
