import { Closer } from './Closer';

export type Observer<T> = (value: T) => void;

export type Subscribe<T> = (observer: Observer<T>) => Closer;

export function subject<T>(observable: Subscribe<T>): Subscribe<T> {
  const observers: Set<Observer<T>> = new Set();
  let stop: Closer | undefined;
  const start = () => {
    if (stop) throw new Error('Observer already started');
    const emit = (value: T) => {
      if (stop !== myStop) throw new Error('Observer called after close');
      for (const observer of observers) {
        observer(value);
      }
    };
    const myStop = (stop = () => {
      close();
      stop = undefined;
    });
    const close = observable(emit);
  };
  return (observer: Observer<T>) => {
    if (observers.has(observer)) throw new Error('Observer already subscribed');
    observers.add(observer);
    if (observers.size === 1) start();
    return () => {
      if (observers.delete(observer) && observers.size === 0) stop!();
    };
  };
}

export type Scheduler = (callback: () => void) => Closer;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace Scheduler {
  export const microTask: Scheduler = callback => {
    let isClosed = false;
    Promise.resolve().then(() => isClosed || callback());
    return () => {
      isClosed = true;
    };
  };

  export function millis(value: number): Scheduler {
    return callback => {
      const id = setTimeout(callback, value);
      return () => {
        clearTimeout(id);
      };
    };
  }
}

export function debounceUnique<T>(source: Subscribe<T[]>, timeout: Scheduler = Scheduler.microTask): Subscribe<T[]> {
  return observer => {
    const buffer: Set<T> = new Set();
    const emit = () => {
      observer(Array.from(buffer));
      buffer.clear();
    };
    let pendingEmit: Closer | undefined;
    const closeSource = source(values => {
      if (buffer.size === 0) {
        pendingEmit = timeout(emit);
      }
      for (const value of values) {
        buffer.add(value);
      }
    });
    const closeEmit = () => pendingEmit?.();
    return Closer.combine(closeEmit, closeSource);
  };
}
