import { Value } from './Value';

export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Context;
  setContext(context: Context): void;
  updateContext<K extends string>(name: K, value: Context[K]): void;
  withContext(context: Context): Self;
}

export interface Context extends Value.Struct {
  openFeature?: {
    targeting_key?: string;
  };
}
