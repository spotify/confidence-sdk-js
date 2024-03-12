import { Value } from "./Value";

export class EventSenderEngine {
    send(name: string, message: Value | undefined, context: Value.Struct): void {
        console.log("Event Sender Engine sent: \n", name, message, context);
    }
}