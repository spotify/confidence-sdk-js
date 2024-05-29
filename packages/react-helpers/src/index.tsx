import { Confidence, Value, FlagEvaluation, Context, Configuration } from '@spotify-confidence/sdk';
import { AccessiblePromise } from '@spotify-confidence/sdk/src/AccessiblePromise';
import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ConfidenceContext = createContext<Confidence | null>(null);

function isRendering(): boolean {
  try {
    // eslint-disable-next-line
    useContext(ConfidenceContext);
    return true;
  } catch (e) {
    return false;
  }
}

class ConfidenceReact extends Confidence {
  readonly scheduleRender: () => void;
  constructor(config: Configuration, parent: Confidence, scheduleRender: () => void) {
    super(config, parent);
    this.scheduleRender = scheduleRender;
    console.log('created react');
  }
  withContext(context: Context): Confidence {
    return isRendering()
      ? useMemo(() => {
          const child = new ConfidenceReact(this.config, this, this.scheduleRender);
          console.log('create child');
          Confidence.prototype.setContext.call(child, context);
          return child;
        }, [this, Value.serialize(context)])
      : super.withContext(context);
  }

  getFlag<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
    const evaluation = super.getFlag(path, defaultValue);
    if (evaluation.reason === 'ERROR' && 'then' in evaluation && isRendering()) throw evaluation;
    return evaluation;
  }

  setContext(context: Context): boolean {
    if (super.setContext(context)) {
      const promise = this.resolveFlags();
      this.rerender(promise);
    }
    return false;
  }

  private rerender(promise: AccessiblePromise<unknown>) {
    if (isRendering() && promise.state === 'PENDING') {
      throw promise;
    } else {
      promise.then(this.scheduleRender);
    }
  }
}
export const ConfidenceProvider: FC<PropsWithChildren<{ confidence: Confidence }>> = ({ confidence, children }) => {
  return <ConfidenceContext.Provider value={confidence} children={children} />;
};

export const WithContext: FC<PropsWithChildren<{ context: Context }>> = ({ context, children }) => {
  // let optionalContext: Value.Struct | undefined;
  // if (Object.keys(context).length > 0) optionalContext = context;
  return <ConfidenceProvider confidence={useConfidence().withContext(context)}>{children}</ConfidenceProvider>;
};

export const useConfidence = (): Confidence => {
  const parent = useContext(ConfidenceContext);
  if (!parent)
    throw new Error('No Confidence instance found, did you forget to wrap your component in ConfidenceProvider?');
  const [count, setState] = useState(0);

  console.log('render count:', count);

  const rerender = useCallback(() => {
    console.log('call set state');
    setState(value => value + 1);
  }, [setState]);

  const child = useMemo(() => new ConfidenceReact(parent.config, parent, rerender), [parent, rerender]);
  // useEffect(
  //   () =>
  //     child.subscribe(_state => {
  //       if (_state === 'READY') rerender(value => value + 1);
  //       // rerender(value => value + 1);
  //     }),
  //   [child],
  // );
  return child;
};

export function useFlagValue<T extends Value>(path: string, defaultValue: T): T {
  return useFlagEvaluation(path, defaultValue).value;
}

export function useFlagEvaluation<T extends Value>(path: string, defaultValue: T): FlagEvaluation<T> {
  const confidence = useConfidence();
  const [evaluation, setEvaluation] = useState(() => confidence.getFlag(path, defaultValue));
  useEffect(
    () =>
      confidence.subscribe(state => {
        console.log(state);
        setEvaluation(confidence.getFlag(path, defaultValue));
      }),
    [confidence, path, defaultValue],
  );
  if (evaluation.reason === 'ERROR' && 'then' in evaluation) {
    throw Promise.resolve(evaluation);
  }
  return evaluation;
}
