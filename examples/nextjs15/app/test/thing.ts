export class Things implements AsyncIterable<string> {
  nextThings: Promise<string>[] = [];
  resolveNextThing?: (thing: string) => void;

  put(thing: string) {
    if (this.resolveNextThing) {
      this.resolveNextThing(thing);
      this.resolveNextThing = undefined;
    } else {
      this.nextThings.push(Promise.resolve(thing));
    }
  }

  async getNextThing(): Promise<string> {
    if (this.nextThings.length) {
      return this.nextThings.shift()!;
    }
    if (this.resolveNextThing) {
      throw new Error('Cannot call getNextThing() while a previous call is still pending');
    }
    return new Promise<string>(resolve => {
      this.resolveNextThing = resolve;
    });
  }

  close() {
    this.put('__done');
  }

  async *[Symbol.asyncIterator]() {
    let thing = await this.getNextThing();
    while (thing !== '__done') {
      yield thing;
      thing = await this.getNextThing();
    }
  }

  static async collect(it: AsyncIterable<string>): Promise<string[]> {
    const things = [];
    for await (const thing of it) {
      things.push(thing);
    }
    return things;
  }
}

type Resolvable<T> = { resolve: (value: T) => void; promise: Promise<T> };
function resolvable<T>(): Resolvable<T> {
  let resolve: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { resolve: resolve!, promise };
}
