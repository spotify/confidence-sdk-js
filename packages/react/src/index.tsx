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

/**
 * Confidence React instance
 * @public
 */
export class ConfidenceReact implements EventSender, Trackable, FlagResolver {
  /**
   * Confidence Delegate
   *  @internal */
  readonly delegate: Confidence;

  constructor(delegate: Confidence) {
    this.delegate = delegate;
  }
  /** Return configurations of the Confidence instance */
  get config(): Configuration {
    return this.delegate.config;
  }

  /**
   * Current serialized Context
   * @internal */
  get contextState(): string {
    return Value.serialize(this.delegate.getContext());
  }

  /**
   * Tracks an event
   * @param name - event name
   * @param message - data to track */
  track(name: string, message?: Value.Struct): void;
  /**
   * Tracks an event
   * @param manager - trackable manager */
  track(manager: Trackable.Manager): Closer;
  /**
   * Tracks an event
   * @param nameOrManager - event name or Trackable Manager */
  track(nameOrManager: string | Trackable.Manager, message?: Value.Struct): Closer | undefined {
    if (typeof nameOrManager === 'function') {
      return this.delegate.track(nameOrManager);
    }
    this.delegate.track(nameOrManager, message);
    return undefined;
  }
  /** Returns context of the current Confidence instance */
  getContext(): Context {
    this.assertContext('getContext', 'useContext');
    return this.delegate.getContext();
  }
  /** Set Confidence context */
  setContext(context: Context, { transition = true } = {}): void {
    if (transition) {
      startTransition(() => {
        this.delegate.setContext(context);
      });
    } else {
      this.delegate.setContext(context);
    }
  }

  /** Subscribe to flag changes in Confidence */
  subscribe(onStateChange?: StateObserver | undefined): () => void {
    return this.delegate.subscribe(onStateChange);
  }
  /** Clears context of current Confidence instance */
  clearContext({ transition = true } = {}): void {
    if (transition) {
      startTransition(() => {
        this.delegate.clearContext();
      });
    } else {
      this.delegate.clearContext();
    }
  }

  /**
   * Creates a new Confidence instance with context
   * @param context - Confidence context
   * @returns ConfidenceReact instance
   */
  withContext(context: Context): ConfidenceReact {
    this.assertContext('withContext', 'useWithContext');
    return new ConfidenceReact(this.delegate.withContext(context));
  }
  /** Evaluates a flag */
  evaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>> {
    this.assertContext('evaluateFlag', 'useEvaluateFlag');
    return this.delegate.evaluateFlag(path, defaultValue);
  }
  /** Returns flag value for a given flag */
  getFlag<T extends Value>(path: string, defaultValue: T): Promise<Value.Widen<T>> {
    this.assertContext('getFlag', 'useFlag');
    return this.delegate.getFlag(path, defaultValue);
  }

  /* eslint-disable react-hooks/rules-of-hooks */

  /** Uses Context */
  useContext(): Context {
    this.assertContext('useContext', 'getContext');
    return useConfidenceContext(this);
  }
  /** Uses Context */
  useWithContext(context: Context): ConfidenceReact {
    this.assertContext('useWithContext', 'withContext');
    return useWithContext(context, this);
  }
  /** Uses EvaluateFlag */
  useEvaluateFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<Value.Widen<T>> {
    this.assertContext('useEvaluateFlag', 'evaluateFlag');
    return useEvaluateFlag(path, defaultValue, this);
  }
  /** Uses Flag */
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

/**
 * Confidence Provider for React
 * @public
 */
export type ConfidenceProvider = FC<PropsWithChildren<{ confidence: Confidence }>> & {
  WithContext: FC<PropsWithChildren<{ context: Context }>>;
};
/**
 * Confidence Provider for React
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ConfidenceProvider: ConfidenceProvider = Object.assign(_ConfidenceProvider, { WithContext });

/**
 * Enables using Confidence
 * @public
 */
export const useConfidence = (): ConfidenceReact => {
  const confidenceReact = useContext(ConfidenceContext);
  if (!confidenceReact)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  return confidenceReact;
};

/**
 * Use with given Confidence Context
 * @public
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useWithContext(context: Context, parent = useConfidence()): ConfidenceReact {
  const child = useMemo(
    () => new ConfidenceReact(parent.delegate.withContext(context)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parent, Value.serialize(context)],
  );

  return child;
}

/**
 * Use Confidence Context
 * @public
 */
// this would be better named useContext, but would then collide with React.useContext
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useConfidenceContext(confidence = useConfidence()): Context {
  const [, setState] = useState(confidence.contextState);
  useEffect(() => {
    return confidence.delegate.contextChanges(() => setState(confidence.contextState));
  });
  return confidence.delegate.getContext();
}

/**
 * Use EvaluateFlag
 * @public */
export function useEvaluateFlag<T extends Value>(
  path: string,
  defaultValue: T,
  // eslint-disable-next-line react-hooks/rules-of-hooks
  confidence = useConfidence(),
): FlagEvaluation<Value.Widen<T>> {
  const evaluation = confidence.delegate.evaluateFlag(path, defaultValue);
  const [, setState] = useState(() => confidence.contextState);
  useEffect(() => {
    return confidence.subscribe(() => {
      setState(confidence.contextState);
    });
  });
  if ('then' in evaluation) throw evaluation;
  return evaluation;
}

/**
 * Use Flag
 * @public
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export function useFlag<T extends Value>(path: string, defaultValue: T, confidence = useConfidence()): Value.Widen<T> {
  return useEvaluateFlag(path, defaultValue, confidence).value;
}
