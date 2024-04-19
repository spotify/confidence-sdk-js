import { Value } from './Value';

type Provider<T> = () => T | Promise<T>;
// type Lazy<T> = (T extends Value.Struct ? { [K in keyof T]: Lazy<T[K]> } : T | Provider<T>);

export type LazyContext = { [K in keyof Context]: Context[K] | Provider<Context[K]> };

export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Promise<Context>;
  setContext(context: LazyContext): void;
  // updateContextEntry<K extends string>(name: K, value: Context[K] | ContextProvider<K>): void;
  // removeContextEntry(name: string): void;
  withContext(context: LazyContext): Self;
  clearContext(): void;
}

type Brand = {
  brand: 'string';
  version: number;
};

export interface Context extends Value.Struct {
  Visitor?: string;
  openFeature?: Value.Struct & {
    targeting_key?: string;
  };
  userAgentData?: {
    brands: Brand[];
    mobile: boolean;
    platform: string;
  };
  page?: {
    path: string;
    referrer: string;
    search: string;
    title: string;
    url: string;
  };
}
