function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

export class AccessiblePromise<T> implements Promise<T> {
  #state: 'PENDING' | 'RESOLVED' | 'REJECTED';
  #value: any;

  protected constructor(value: any, rejected?: boolean) {
    this.#value = value;
    if (isPromiseLike(value)) {
      // both value and reason can be promise like in which case we are still pending
      this.#state = 'PENDING';
      value.then(
        v => {
          this.#state = 'RESOLVED';
          this.#value = v;
        },
        reason => {
          this.#state = 'REJECTED';
          this.#value = reason;
        },
      );
    } else {
      this.#state = rejected ? 'REJECTED' : 'RESOLVED';
    }
  }

  protected chain<S>(value: any, rejected?: boolean): AccessiblePromise<S> {
    if (value instanceof AccessiblePromise) return value;
    return new AccessiblePromise(value, rejected);
  }

  get state(): 'PENDING' | 'RESOLVED' | 'REJECTED' {
    return this.#state;
  }
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): AccessiblePromise<TResult1 | TResult2> {
    let value = this.#value;
    let rejected = false;
    // eslint-disable-next-line default-case
    switch (this.#state) {
      case 'PENDING':
        value = value.then(onfulfilled, onrejected);
        break;
      case 'RESOLVED':
        if (onfulfilled) {
          try {
            value = onfulfilled(value);
          } catch (e) {
            value = e;
            rejected = true;
          }
        }
        break;
      case 'REJECTED':
        if (onrejected) {
          try {
            value = onrejected(value);
          } catch (e) {
            value = e;
            rejected = true;
          }
        }
        break;
    }
    return this.chain(value, rejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
  ): AccessiblePromise<T | TResult> {
    return this.then(undefined, onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): AccessiblePromise<T> {
    return this.then(
      value => {
        onfinally?.();
        return value;
      },
      reason => {
        onfinally?.();
        throw reason;
      },
    );
  }

  orSupply(supplier: () => T): T {
    if (this.#state === 'RESOLVED') {
      return this.#value as T;
    }
    if (this.#state === 'REJECTED') {
      throw this.#value;
    }
    return supplier();
  }
  orSuspend(): T {
    return this.orSupply(() => {
      const error = new Error('Promise is not fulfilled.');
      const then = this.#value.then.bind(this.#value);
      throw Object.assign(error, { then });
    });
  }
  orThrow(): T {
    return this.orSupply(() => {
      throw new Error('Promise is not fulfilled.');
    });
  }
  or(value: T): T {
    return this.orSupply(() => value);
  }

  get [Symbol.toStringTag]() {
    return 'AccessiblePromise';
  }

  static resolve<T = void>(value?: T | PromiseLike<T>): AccessiblePromise<Awaited<T>> {
    if (value instanceof AccessiblePromise) return value;
    return new AccessiblePromise(value);
  }

  static reject<T = never>(reason?: any): AccessiblePromise<T> {
    return new AccessiblePromise(reason, true);
  }
}
