export namespace Cache {
  export interface Data<T> {
    entries: AsyncIterable<[string, T]>;
  }

  export type Supplier<T> = (key: string) => Promise<T>;
}

type EntryNode<T> = {
  key: string;
  value: Promise<T>;
  next: Promise<CacheNode<T>>;
};

type RefNode<T> = {
  refCount: number;
  next: Promise<CacheNode<T>>;
};

type CacheNode<T> = EntryNode<T> | RefNode<T>;
export class Cache<T> {
  private data: Map<string, Promise<T>> = new Map();
  private resolveNext!: (node: CacheNode<T>) => void;
  private head: Promise<CacheNode<T>>;
  private refCount = 0;

  constructor(data?: Cache.Data<T>) {
    console.log('creating cache');
    this.head = new Promise(resolve => {
      this.resolveNext = resolve;
    });
    if (data) {
      this.load(data);
    }
  }

  private async load(data: Cache.Data<T>) {
    for await (const [key, value] of data.entries) {
      console.log('loading cache', key);
      this.put(key, Promise.resolve(value));
    }
    console.log('loaded cache done!');
  }

  private addNode(node: Omit<CacheNode<T>, 'next'>): void {
    const resolveCurr = this.resolveNext;
    const next = new Promise<CacheNode<T>>(resolve => {
      this.resolveNext = resolve;
    });
    resolveCurr({
      ...node,
      next,
    } as CacheNode<T>);
  }

  put(key: string, value: Promise<T>) {
    this.data.set(key, value);
    this.addNode({ key, value });
  }

  get(key: string, supplier: Cache.Supplier<T>): Promise<T> {
    let value = this.data.get(key);
    if (!value) {
      console.log('cache miss', key);
      value = supplier(key);
      this.put(key, value);
    } else {
      console.log('cache hit', key);
    }
    return value;
  }

  private async *entries(): AsyncIterableIterator<[string, T]> {
    let next = this.head;
    const refCount = this.refCount;
    let remaining = refCount === 0 ? this.data.size : Infinity;
    while (remaining > 0) {
      const node = await next;
      if ('refCount' in node) {
        // a close node
        if (node.refCount < refCount) {
          return;
        }
      } else {
        remaining--;
        yield [node.key, await node.value];
      }
      next = node.next;
    }
  }

  ref() {
    this.addNode({ refCount: ++this.refCount });
  }

  unref() {
    this.addNode({ refCount: --this.refCount });
  }

  toData(): Cache.Data<T> {
    const self = this;
    return {
      entries: {
        [Symbol.asyncIterator]() {
          const entries = self.entries();
          return entries;
        },
      },
    };
  }
}
