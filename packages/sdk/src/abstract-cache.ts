import { AccessiblePromise } from './AccessiblePromise';

export interface Codec<T, S> {
  stringify(value: T): S;
  parse(value: S): T;
}
interface CacheValue<T> {
  pending: Promise<T>;
  resolve?: (value?: T) => void;
  node?: LinkNode<T>;
}
interface LinkNode<T> {
  key: string;
  value: T;
  prev: LinkNode<T> | undefined;
  next: Promise<LinkNode<T>> | LinkNode<T>;
}
export abstract class AbstractCache<K, T, S = unknown> implements AsyncIterable<[string, S]> {
  private readonly data = new Map<string, CacheValue<T>>();
  private head: Promise<LinkNode<T>> | LinkNode<T>;
  private tail: LinkNode<T> | undefined;
  private resolveNext!: (node: LinkNode<T>) => void;
  private pendingUpdates = 0;
  private loading: boolean = false;

  constructor(entries?: AsyncIterable<[string, S]>) {
    this.head = new Promise(resolve => {
      this.resolveNext = resolve;
    });
    this.load(entries);
  }

  protected abstract serialize(value: T): S;

  protected abstract deserialize(data: S): T;

  protected abstract serializeKey(key: K): string;

  protected merge(newValue: T, _oldValue: T): T {
    return newValue;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<[string, S]> {
    let cursor = this.head;
    while (!('then' in cursor) || this.pendingUpdates) {
      const node = await cursor;
      yield [node.key, this.serialize(node.value)];
      cursor = node.next;
    }
  }

  async load(entries?: AsyncIterable<[string, S]>) {
    if (!entries) return;
    this.loading = true;
    try {
      for await (const [key, value] of entries) {
        const cacheValue = this.data.get(key);
        if (cacheValue && cacheValue.resolve) {
          cacheValue.resolve(this.deserialize(value));
          delete cacheValue.resolve;
        } else {
          this.put(key, AccessiblePromise.resolve(this.deserialize(value)));
        }
      }
      for (const cacheValue of this.data.values()) {
        if (cacheValue.resolve) {
          cacheValue.resolve();
          delete cacheValue.resolve;
        }
      }
    } finally {
      this.loading = false;
    }
  }

  get(key: K, supplier: (key: K) => Promise<T>): Promise<T> {
    const serializedKey = this.serializeKey(key);
    let cacheValue = this.data.get(serializedKey);
    if (!cacheValue) {
      if (this.loading) {
        let resolve!: (value?: T) => void;
        const pending = AccessiblePromise.resolve(
          new Promise<T>(res => {
            resolve = (value?: T) => {
              res(value ?? supplier(key));
            };
          }),
        );
        cacheValue = { pending, resolve };
      } else {
        const pending = AccessiblePromise.resolve(supplier(key));
        cacheValue = { pending };
      }
      this.put(serializedKey, cacheValue.pending, cacheValue.resolve);
    }
    return cacheValue.pending;
  }

  private async put(serializedKey: string, pending: Promise<T>, resolve?: (value?: T) => void) {
    this.pendingUpdates++;
    try {
      let cacheValue = this.data.get(serializedKey);
      if (!cacheValue) {
        cacheValue = { pending, resolve };
        this.data.set(serializedKey, cacheValue);
      } else {
        cacheValue.pending = pending;
        cacheValue.resolve = resolve;
      }
      const oldNode = cacheValue.node;
      try {
        let value: T = await pending;
        if (cacheValue.pending !== pending) {
          // we're not the latest value, do nothing
          return;
        }
        // add the node last
        const resolveNext = this.resolveNext;
        const next = new Promise<LinkNode<T>>(resolve => {
          this.resolveNext = resolve;
        });
        if (oldNode) {
          value = this.merge(value, oldNode.value);
        }
        const node = { key: serializedKey, value, prev: this.tail, next };
        if (this.tail) {
          this.tail.next = node;
        } else {
          this.head = node;
        }
        this.tail = cacheValue.node = node;
        resolveNext(node);
      } catch (e) {
        if (cacheValue.pending !== pending) {
          // we're not the latest value, do nothing
          return;
        }
      }
      if (oldNode) {
        // remove old node
        if (oldNode.prev) {
          oldNode.prev.next = oldNode.next;
        } else {
          this.head = oldNode.next;
        }
        if ('then' in oldNode.next) {
          if (oldNode !== this.tail)
            throw new Error('Assertion error. LinkNode.next should be resolved unless the node is the last one');
          this.tail = undefined;
        } else {
          oldNode.next.prev = oldNode.prev;
        }
      }
    } finally {
      this.pendingUpdates--;
    }
  }

  static forCodec<T, S extends string>(
    codec: Codec<T, S>,
  ): new (entries?: AsyncIterable<[string, S]>) => AbstractCache<T, T, S> {
    return class extends AbstractCache<T, T, S> {
      protected serializeKey(key: T): string {
        return codec.stringify(key);
      }

      protected serialize(value: T): S {
        return codec.stringify(value);
      }

      protected deserialize(value: S): T {
        return codec.parse(value);
      }
    };
  }
}
