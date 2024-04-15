import { Value } from './Value';

export type ContextProvider<K extends string> = () => Context[K] | Promise<Context[K]>


export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Promise<Context>;
  setContext(context: Context): void;
  updateContextEntry<K extends string>(name: K, value: Context[K] | ContextProvider<K>): void;
  removeContextEntry(name: string): void;
  withContext(context: Context): Self;
  clearContext(): void;
}

type Brand = {
  brand: 'string';
  version: number;
};

export interface Context extends Value.Struct {
  visitorId?: string,
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


