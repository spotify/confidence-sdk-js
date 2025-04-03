function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

export class AccessiblePromise<T> implements Promise<T> {
  #status: 'pending' | 'fulfilled' | 'rejected';
  #value: any;

  protected constructor(value: any, rejected?: boolean) {
    this.#value = value;
    if (isPromiseLike(value)) {
      // both value and reason can be promise like in which case we are still pending
      this.#status = 'pending';
      value.then(
        v => {
          this.#status = 'fulfilled';
          this.#value = v;
        },
        reason => {
          this.#status = 'rejected';
          this.#value = reason;
        },
      );
    } else {
      this.#status = rejected ? 'rejected' : 'fulfilled';
    }
  }

  protected chain<S>(value: any, rejected?: boolean): AccessiblePromise<S> {
    if (value instanceof AccessiblePromise) return value;
    return new AccessiblePromise(value, rejected);
  }

  get status(): 'pending' | 'fulfilled' | 'rejected' {
    return this.#status;
  }

  get value(): T {
    switch (this.#status) {
      case 'fulfilled':
        return this.#value;
      case 'rejected':
        throw this.#value;
      case 'pending':
        throw Object.assign(new Error('Promise is pending.'), { then: this.then.bind(this) });
      default:
        throw new Error('Unreachable');
    }
  }

  get reason(): unknown {
    switch (this.#status) {
      case 'fulfilled':
        return undefined;
      case 'rejected':
        throw this.#value;
      case 'pending':
        throw Object.assign(new Error('Promise is pending.'), { then: this.then.bind(this) });
      default:
        throw new Error('Unreachable');
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): AccessiblePromise<TResult1 | TResult2> {
    let value = this.#value;
    let rejected = false;
    // eslint-disable-next-line default-case
    switch (this.#status) {
      case 'pending':
        value = value.then(onfulfilled, onrejected);
        break;
      case 'fulfilled':
        if (onfulfilled) {
          try {
            value = onfulfilled(value);
          } catch (e) {
            value = e;
            rejected = true;
          }
        }
        break;
      case 'rejected':
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
    if (this.#status === 'fulfilled') {
      return this.#value as T;
    }
    if (this.#status === 'rejected') {
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
