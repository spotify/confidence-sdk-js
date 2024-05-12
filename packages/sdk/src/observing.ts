import { Closer } from './Closer';

export type Observer<T> = (value: T) => void;

export type Subscribe<T> = (observer: Observer<T>) => Closer;

function multicast<T>(observers: Set<Observer<T>>, observable: Subscribe<T>) {
  let close: Closer | undefined;
  return () => {
    if (close) {
      close();
      close = undefined;
    } else {
      close = observable(value => {
        for (const observer of observers) {
          observer(value);
        }
      });
    }
  };
}
export function subject<T>(observable: Subscribe<T>): Subscribe<T> {
  const observers: Set<Observer<T>> = new Set();
  const toggle = multicast(observers, observable);
  return (observer: Observer<T>) => {
    if (!observers.has(observer)) {
      observers.add(observer);
      if (observers.size === 1) {
        toggle();
      }
    }
    return () => {
      if (observers.delete(observer) && observers.size === 0) toggle();
    };
  };
}
