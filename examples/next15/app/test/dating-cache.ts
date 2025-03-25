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

export abstract class Cache<T, S = T> implements AsyncIterable<[string, S]> {
  private data = new Map<string, CacheValue<T>>();
  private head: Promise<LinkNode<T>> | LinkNode<T>;
  private tail: LinkNode<T> | undefined;
  private resolveNext!: (node: LinkNode<T>) => void;
  private pendingUpdates = 0;
  private loading: boolean = false;

  constructor(entries?: AsyncIterable<[string, S]>) {
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
        this.put(key, Promise.resolve(this.deserialize(value)));
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

  get(key: string, supplier: (key: string) => Promise<T>): Promise<T> {
    let cacheValue = this.data.get(key);
    if (!cacheValue) {
      if (this.loading) {
        console.log('cache wait for loading', key);
        let resolve!: (value?: T) => void;
        const pending = new Promise<T>(res => {
          resolve = (value?: T) => {
            res(value ?? supplier(key));
          };
        });
        cacheValue = { pending, resolve };
      } else {
        const pending = supplier(key);
        cacheValue = { pending };
      }
      this.put(key, cacheValue.pending, cacheValue.resolve);
    }
    return cacheValue.pending;
  }

  private async put(key: string, pending: Promise<T>, resolve?: (value?: T) => void) {
    this.pendingUpdates++;
    let cacheValue = this.data.get(key);
    if (!cacheValue) {
      cacheValue = { pending, resolve };
      this.data.set(key, cacheValue);
    } else {
      cacheValue.pending = pending;
      cacheValue.resolve = resolve;
    }
    let oldNode = cacheValue.node;
    try {
      const value = await pending;
      console.log('cache resolved', key);
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
      const node = { key, value, prev: this.tail, next };
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

  static forCodec<T, S>(codec: Codec<T, S>): new (entries?: AsyncIterable<[string, S]>) => Cache<T, S> {
    return class extends Cache<T, S> {
      constructor(entries?: AsyncIterable<[string, S]>) {
        super(entries);
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
