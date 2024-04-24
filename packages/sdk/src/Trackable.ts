import { Closer } from './Closer';
import { Confidence } from './Confidence';
import { Value } from './Value';
import { Context } from './context';

export namespace Trackable {
  export type Controller = Pick<Confidence, 'setContext' | 'track' | 'config'>;
  export type Cleanup = void | Closer;
  export type Manager = (controller: Controller) => Cleanup;

  class RevocableController implements Controller {
    #isRevoked = false;
    #delegate: Controller;
    #childTrackers: Closer[] = [];

    constructor(delegate: Controller) {
      this.#delegate = delegate;
    }
    setContext(context: Context): void {
      this.assertNonRevoked();
      return this.#delegate.setContext(context);
    }

    track(name: string, message?: Value.Struct): void;
    track(manager: Trackable.Manager): Closer;
    track(nameOrManager: string | Trackable.Manager, message?: Value.Struct): Closer | void {
      this.assertNonRevoked();
      if (typeof nameOrManager === 'function') {
        // if the manager starts tracking something
        const closer = this.#delegate.track(nameOrManager);
        this.#childTrackers.push(closer);
        return closer;
      }
      return this.#delegate.track(nameOrManager, message);
    }
    get config() {
      this.assertNonRevoked();
      return this.#delegate.config;
    }

    revoke() {
      this.#isRevoked = true;
      for (const closer of this.#childTrackers) {
        closer();
      }
    }

    private assertNonRevoked(): void {
      if (this.#isRevoked) throw new Error('The tracker is closed');
    }
  }

  export function setup(controller: Controller, manager: Manager): Closer {
    const revocableController = new RevocableController(controller);
    const cleanup = manager(revocableController);
    return () => {
      try {
        cleanup?.();
      } finally {
        revocableController.revoke();
      }
    };
  }
}
export interface Trackable {
  track(manager: Trackable.Manager): Closer;
}
