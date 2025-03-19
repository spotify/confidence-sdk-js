export class Things implements AsyncIterable<string> {
  refCount = 0;
  nextThings: Promise<string>[] = [];
  resolveNextThing?: (thing: string | Promise<string>) => void;

  put<T extends string | Promise<string>>(thing: T): T {
    if (this.resolveNextThing) {
      this.resolveNextThing(thing);
      this.resolveNextThing = undefined;
    } else {
      this.nextThings.push(Promise.resolve(thing));
    }
    return thing;
  }

  private async getNextThing(): Promise<string> {
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

  ref() {
    this.refCount++;
  }

  unref() {
    this.refCount--;
    if (this.refCount === 0) {
      this.put('');
    }
  }

  async *[Symbol.asyncIterator]() {
    if (this.refCount === 0) return;
    let thing = await this.getNextThing();
    while (thing) {
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
