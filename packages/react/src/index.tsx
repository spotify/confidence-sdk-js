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

import React, {
  createContext,
  FC,
  PropsWithChildren,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ConfidenceContext = createContext<ConfidenceReact | null>(null);

function isRendering(): boolean {
  try {
    // eslint-disable-next-line
    useContext(ConfidenceContext);
    return true;
  } catch (e) {
    return false;
  }
}

export class ConfidenceReact implements EventSender, Trackable, FlagResolver {
  /** @internal */
  readonly delegate: Confidence;

  constructor(delegate: Confidence) {
    this.delegate = delegate;
  }

  get config(): Configuration {
    return this.delegate.config;
  }

  /** @internal */
  get contextState(): string {
    return Value.serialize(this.delegate.getContext());
  }

  track(name: string, message?: Value.Struct): void;
  track(manager: Trackable.Manager): Closer;
  track(nameOrManager: string | Trackable.Manager, message?: Value.Struct): Closer | undefined {
    if (typeof nameOrManager === 'function') {
      return this.delegate.track(nameOrManager);
    }
    this.delegate.track(nameOrManager, message);
    return undefined;
  }
  getContext(): Context {
    this.assertContext('getContext', 'useContext');
    return this.delegate.getContext();
  }
  setContext(context: Context, { transition = true } = {}): void {
    if (transition) {
      startTransition(() => {
        this.delegate.setContext(context);
      });
    } else {
      this.delegate.setContext(context);
    }
  }

  subscribe(onStateChange?: StateObserver | undefined): () => void {
    return this.delegate.subscribe(onStateChange);
  }
  clearContext({ transition = true } = {}): void {
    if (transition) {
      startTransition(() => {
        this.delegate.clearContext();
      });
    } else {
      this.delegate.clearContext();
    }
  }

  withContext(context: Context): ConfidenceReact {
    this.assertContext('withContext', 'useWithContext');
    return new ConfidenceReact(this.delegate.withContext(context));
  }
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>> {
    this.assertContext('evaluateFlag', 'useEvaluateFlag');
    return this.delegate.evaluateFlag(path, defaultValue);
  }
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<Value.Widen<T>> {
    this.assertContext('getFlag', 'useFlag');
    return this.delegate.getFlag(path, defaultValue);
  }

  /* eslint-disable react-hooks/rules-of-hooks */

  useContext(): Context {
    this.assertContext('useContext', 'getContext');
    return useConfidenceContext(this);
  }
  useWithContext(context: Context): ConfidenceReact {
    this.assertContext('useWithContext', 'withContext');
    return useWithContext(context, this);
  }
  useEvaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>> {
    this.assertContext('useEvaluateFlag', 'evaluateFlag');
    return useEvaluateFlag(path, defaultValue, this);
  }
  useFlag<T extends Value>(path: string, defaultValue: T): Value.Widen<T> {
    this.assertContext('useFlag', 'getFlag');
    return useFlag(path, defaultValue, this);
  }

  /* eslint-enable react-hooks/rules-of-hooks */

  private assertContext(fnName: string, altFnName: string) {
    if (fnName.startsWith('use')) {
      if (!isRendering())
        throw new Error(
          `${fnName} called outside the body of a function component. Did you mean to call ${altFnName}?`,
        );
    } else {
      if (isRendering())
        throw new Error(`${fnName} called inside the body of a function component. Did you mean to call ${altFnName}?`);
    }
  }
}
const _ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => {
  const confidenceReact = useMemo(() => new ConfidenceReact(confidence), [confidence]);
  return <ConfidenceContext.Provider value={confidenceReact} children={children} />;
};

const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  const child = useConfidence().useWithContext(context);
  return <ConfidenceContext.Provider value={child}>{children}</ConfidenceContext.Provider>;
};

export type ConfidenceProvider = FC<PropsWithChildren<{ confidence: Confidence }>> & {
  WithContext: FC<PropsWithChildren<{ context: Context }>>;
};
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ConfidenceProvider: ConfidenceProvider = Object.assign(_ConfidenceProvider, { WithContext });

export const useConfidence = (): ConfidenceReact => {
  const confidenceReact = useContext(ConfidenceContext);
  if (!confidenceReact)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  return confidenceReact;
};

// eslint-disable-next-line react-hooks/rules-of-hooks
export function useWithContext(context: Context, parent = useConfidence()): ConfidenceReact {
  const child = useMemo(
    () => new ConfidenceReact(parent.delegate.withContext(context)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent, Value.serialize(context)],
  );

  return child;
}

// this would be better named useContext, but would then collide with React.useContext
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useConfidenceContext(confidence = useConfidence()): Context {
  const [, setState] = useState(confidence.contextState);
  useEffect(() => {
    return confidence.delegate.contextChanges(() => setState(confidence.contextState));
  });
  return confidence.delegate.getContext();
}

export function useEvaluateFlag<T extends Value>(
  path: string,
  defaultValue: T,
  // eslint-disable-next-line react-hooks/rules-of-hooks
  confidence = useConfidence(),
): FlagEvaluation<Value.Widen<T>> {
  const evaluation = confidence.delegate.evaluateFlag(path, defaultValue);
  const [, setState] = useState(() => confidence.contextState);
  useEffect(() => {
    return confidence.delegate.contextChanges(() => {
      setState(confidence.contextState);
    });
  });
  if ('then' in evaluation) throw evaluation;
  return evaluation;
}

// eslint-disable-next-line react-hooks/rules-of-hooks
export function useFlag<T extends Value>(path: string, defaultValue: T, confidence = useConfidence()): Value.Widen<T> {
  return useEvaluateFlag(path, defaultValue, confidence).value;
}
