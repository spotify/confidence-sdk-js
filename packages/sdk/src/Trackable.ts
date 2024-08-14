import { Closer } from './Closer';
import { Confidence } from './Confidence';
import { Context } from './context';
import { EventData } from './events';

/**
 * Namespace describing something to track
 * @public
 */
export namespace Trackable {
  /** Trackable Controller */
  export type Controller = Pick<Confidence, 'setContext' | 'track' | 'config'>;
  /** Trackable Cleanup */
  export type Cleanup = void | Closer;
  /** Trackable Manager */
  export type Manager = (controller: Controller) => Cleanup;

  class RevocableController implements Controller {
    #isRevoked = false;
    #delegate: Controller;
    #childTrackers: Closer[] = [];

    constructor(delegate: Controller) {
      this.#delegate = delegate;
    }
    setContext(context: Context): boolean {
      this.assertNonRevoked();
      return this.#delegate.setContext(context);
    }

    track(name: string, data?: EventData): void;
    track(manager: Trackable.Manager): Closer;
    track(nameOrManager: string | Trackable.Manager, data?: EventData): Closer | void {
      this.assertNonRevoked();
      if (typeof nameOrManager === 'function') {
        // if the manager starts tracking something
        const closer = this.#delegate.track(nameOrManager);
        this.#childTrackers.push(closer);
        return closer;
      }
      return this.#delegate.track(nameOrManager, data);
    }
    get config() {
      this.assertNonRevoked();
      return this.#delegate.config;
    }

    get isRevoked() {
      return this.#isRevoked;
    }

    revoke() {
      if (this.#isRevoked) return;
      this.#isRevoked = true;
      while (this.#childTrackers.length > 0) {
        const closer = this.#childTrackers.pop()!;
        closer();
      }
    }

    private assertNonRevoked(): void {
      if (this.#isRevoked) throw new Error('The tracker is closed');
    }
  }

  /** Setup of Trackable */
  export function setup(controller: Controller, manager: Manager): Closer {
    const revocableController = new RevocableController(controller);
    const cleanup = manager(revocableController);
    return () => {
      if (revocableController.isRevoked) return;
      try {
        cleanup?.();
      } finally {
        revocableController.revoke();
      }
    };
  }
}
/**
 * Namespace describing something to track
 * @public
 */
export interface Trackable {
  /** Tracks an event given a Trackable Manager */
  track(manager: Trackable.Manager): Closer;
}
