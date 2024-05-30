import {
  Closer,
  Confidence,
  Value,
  FlagEvaluation,
  Context,
  Configuration,
  EventSender,
  FlagResolver,
  StateObserver,
  Trackable,
} from '@spotify-confidence/sdk';

import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

const ConfidenceContext = createContext<ConfidenceReact | null>(null);

// function isRendering(): boolean {
//   try {
//     // eslint-disable-next-line
//     useContext(ConfidenceContext);
//     return true;
//   } catch (e) {
//     return false;
//   }
// }

export class ConfidenceReact implements EventSender, Trackable, FlagResolver {
  #delegate: Confidence;

  constructor(delegate: Confidence) {
    this.#delegate = delegate;
  }

  get config(): Configuration {
    return this.#delegate.config;
  }

  track(name: string, message?: Value.Struct): void;
  track(manager: Trackable.Manager): Closer;
  track(nameOrManager: string | Trackable.Manager, message?: Value.Struct): Closer | undefined {
    if (typeof nameOrManager === 'function') {
      return this.#delegate.track(nameOrManager);
    } else {
      this.#delegate.track(nameOrManager, message);
      return;
    }
  }
  getContext(): Context {
    return this.#delegate.getContext();
  }
  setContext(context: Context): void {
    this.#delegate.setContext(context);
  }

  useWithContext(context: Context): ConfidenceReact {
    const child = useMemo(() => this.withContext(context), [parent, Value.serialize(context)]);

    const [, setState] = useState(0);
    useEffect(
      () =>
        child.subscribe(state => {
          if (state === 'READY') setState(value => value + 1);
        }),
      [child, setState],
    );
    return child;
  }
  withContext(context: Context): ConfidenceReact {
    const child = this.#delegate.withContext(context);
    return new ConfidenceReact(child);
  }
  subscribe(onStateChange?: StateObserver | undefined): () => void {
    return this.#delegate.subscribe(onStateChange);
  }
  useFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    const evaluation = this.#delegate.getFlag(path, defaultValue);
    // TODO make it a setting to _enable skip throwing_ on stale value.
    if (evaluation.reason === 'ERROR' && 'then' in evaluation) throw evaluation;
    return evaluation;
  }
  getFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    return this.#delegate.getFlag(path, defaultValue);
  }
  clearContext(): void {
    this.#delegate.clearContext();
  }
}
export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => {
  const confidenceReact = useMemo(() => new ConfidenceReact(confidence), [confidence]);
  return <ConfidenceContext.Provider value={confidenceReact} children={children} />;
};

// TODO make this a child of ConfidenceProvider instead `ConfidenceProvider.WithContext`
export const ConfidenceProviderWithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  const child = useConfidence().useWithContext(context);
  return <ConfidenceContext.Provider value={child}>{children}</ConfidenceContext.Provider>;
};

export const useConfidence = (): ConfidenceReact => {
  const confidenceReact = useContext(ConfidenceContext);
  if (!confidenceReact)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  const [, setState] = useState(0);

  useEffect(
    () =>
      confidenceReact.subscribe(state => {
        if (state === 'READY') setState(value => value + 1);
      }),
    [confidenceReact, setState],
  );
  return confidenceReact;
};
