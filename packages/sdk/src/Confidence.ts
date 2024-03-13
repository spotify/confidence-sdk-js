import { FlagResolution, FlagResolverClient } from "./flags"
import { EventSenderEngine } from "./EventSenderEngine"
import { Value } from "./Value"

export interface EventSender extends Contextual {
    sendEvent(name: string, message?: Value): void
}

export interface Contextual {
    context(): Value.Struct
    put(name: string, value: Value): void
    remove(name: string): void
}

interface Configuration {
    readonly clientSecret: string,
    readonly eventSenderEngine: EventSenderEngine
    readonly flagResolverClient: FlagResolverClient
}

export class Confidence implements EventSender {
    private readonly config: Configuration
    private _context: Map<string, Value> = new Map
    constructor(config: Configuration) {
        this.config = config
    }
    sendEvent(name: string, message?: Value) {
        this.config.eventSenderEngine.send(name, message, this.context())
    }
    context(): Value.Struct {
        const context: Record<string, Value> = {}
        for (const [key, value] of this._context) {
            context[key] = value
        }
        return Object.freeze(context)
    }
    put(name: string, value: Value) {
        this._context.set(name, Value.clone(value))
    }
    remove(name: string) {
        this._context.delete(name)
    }
    resolve(flagNames: string[]): Promise<FlagResolution> {
        return this.config.flagResolverClient.resolve(this.context(), {apply:false, flags:flagNames})
    }
}
