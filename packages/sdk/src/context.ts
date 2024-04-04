import { Value } from './Value';

export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Context;
  setContext(context: Context): void;
  updateContextEntry<K extends string>(name: K, value: Context[K]): void;
  removeContextEntry(name: string): void;
  withContext(context: Context): Self;
  clearContext(): void;
}

export interface Context extends Value.Struct {
  openFeature?: Value.Struct & {
    targeting_key?: string;
  };
}
