import { AccessiblePromise } from './AccessiblePromise';

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

export interface Codec<T, S> {
  stringify(value: T): S;
  parse(value: S): T;
}

export abstract class Cache<K, T, S = T> implements AsyncIterable<[string, S]> {
  private data = new Map<string, CacheValue<T>>();
  private head: Promise<LinkNode<T>> | LinkNode<T>;
  private tail: LinkNode<T> | undefined;
  private resolveNext!: (node: LinkNode<T>) => void;
  private pendingUpdates = 0;
  private loading: boolean = false;

  constructor(entries?: AsyncIterable<[string, S]>) {
    console.log('cache constructor');
    this.head = new Promise(resolve => {
      this.resolveNext = resolve;
    });
    if (entries) {
      this.load(entries);
    }
  }

  ref() {
    this.pendingUpdates++;
  }

  unref() {
    this.pendingUpdates--;
  }

  protected abstract serialize(value: T): S;

  protected abstract deserialize(value: S): T;

  protected abstract serializeKey(key: K): string;

  async *[Symbol.asyncIterator](): AsyncIterator<[string, S]> {
    let cursor = this.head;
    while (!('then' in cursor) || this.pendingUpdates) {
      const node = await cursor;
      yield [node.key, this.serialize(node.value)];
      cursor = node.next;
    }
  }

  private async load(entries: AsyncIterable<[string, S]>) {
    this.loading = true;
    for await (const [key, value] of entries) {
      let cacheValue = this.data.get(key);
      if (cacheValue && cacheValue.resolve) {
        cacheValue.resolve(this.deserialize(value));
        delete cacheValue.resolve;
      } else {
        console.log('cache load', key);
        this.put(key, AccessiblePromise.resolve(this.deserialize(value)));
      }
    }
    for (const cacheValue of this.data.values()) {
      if (cacheValue.resolve) {
        cacheValue.resolve();
        delete cacheValue.resolve;
      }
    }
    this.loading = false;
  }

  get(key: K, supplier: (key: K) => Promise<T>): Promise<T> {
    const serializedKey = this.serializeKey(key);
    let cacheValue = this.data.get(serializedKey);
    if (!cacheValue) {
      if (this.loading) {
        console.log('cache wait for loading', serializedKey);
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
    debugger;
    return cacheValue.pending;
  }

  private async put(serializedKey: string, pending: Promise<T>, resolve?: (value?: T) => void) {
    this.pendingUpdates++;
    let cacheValue = this.data.get(serializedKey);
    //debugger;
    if (!cacheValue) {
      cacheValue = { pending, resolve };
      this.data.set(serializedKey, cacheValue);
    } else {
      cacheValue.pending = pending;
      cacheValue.resolve = resolve;
    }
    let oldNode = cacheValue.node;
    try {
      const value = await pending;
      console.log('cache resolved', serializedKey);
      if (cacheValue.pending !== pending) {
        // we're not the latest value
        oldNode = undefined;
        return;
      }
      // add the node last
      const resolveNext = this.resolveNext;
      const next = new Promise<LinkNode<T>>(resolve => {
        this.resolveNext = resolve;
      });
      const node = { key: serializedKey, value, prev: this.tail, next };
      if (this.tail) {
        this.tail.next = node;
      }
      this.tail = cacheValue.node = node;
      resolveNext(node);
    } finally {
      this.pendingUpdates--;
      if (oldNode) {
        // remove old node
        if (oldNode.prev) {
          oldNode.prev.next = oldNode.next;
        } else {
          this.head = oldNode.next;
        }
        if ('then' in oldNode.next) {
          // oldNode can't be last since we've just added a new node
          throw new Error('Assertion error. Next node should be resolved.');
        }
        oldNode.next.prev = oldNode.prev;
      }
    }
  }

  static forCodec<T, S extends string>(
    codec: Codec<T, S>,
  ): new (entries?: AsyncIterable<[string, S]>) => Cache<T, T, S> {
    return class extends Cache<T, T, S> {
      constructor(entries?: AsyncIterable<[string, S]>) {
        super(entries);
      }

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
