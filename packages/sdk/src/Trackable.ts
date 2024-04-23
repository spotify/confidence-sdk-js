import { Closer } from './Closer';
import { Value } from './Value';
import { Context } from './context';
import { EventSender } from './events';

export namespace Trackable {
  export type Controller = Pick<EventSender, 'setContext' | 'sendEvent'>;
  export type Cleanup = void | Closer;
  export type Manager = (controller: Controller) => Cleanup;

  class RevocableController implements Controller {
    #delegate: () => Controller;

    constructor(delegate: () => Controller) {
      this.#delegate = delegate;
    }
    setContext(context: Context): void {
      return this.#delegate().setContext(context);
    }
    sendEvent(name: string, message?: Value.Struct | undefined): void {
      return this.#delegate().sendEvent(name, message);
    }
  }

  export function setup(controller: Controller, manager: Manager): Closer {
    let isClosed = false;
    const delegate = () => {
      if (isClosed) throw new Error('Controller is closed');
      return controller;
    };
    try {
      const cleanup = manager(new RevocableController(delegate));
      return () => {
        if (isClosed) return;
        try {
          cleanup?.();
        } finally {
          isClosed = true;
        }
      };
    } catch (e) {
      isClosed = true;
      throw e;
    }
  }
}
export interface Trackable {
  track(manager: Trackable.Manager): Closer;
}
