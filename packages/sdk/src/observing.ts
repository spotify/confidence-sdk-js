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
