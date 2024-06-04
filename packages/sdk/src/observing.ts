import { Closer } from './Closer';

// This is a utility type which comes packaged with TS 5.4 and later.
type NoInfer<T> = [T][T extends any ? 0 : never];

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
    if (observers.has(observer)) throw new Error('Observer already subscribed.');
    observers.add(observer);
    if (observers.size === 1) {
      toggle();
    }
    return () => {
      if (observers.delete(observer) && observers.size === 0) toggle();
    };
  };
}

export function changeObserver<T>(observer: Observer<T>, initialValue?: NoInfer<T>): Observer<T> {
  let prevValue: T | undefined = initialValue;
  return (value: T) => {
    if (!Object.is(value, prevValue)) {
      prevValue = value;
      observer(value);
    }
  };
}
