import { Value } from './Value';

export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Context;
  setContext(context: Context): void;
  withContext(context: Context): Self;
  clearContext(): void;
}

export interface Context extends Value.Struct {
  visitor_id?: string;
  openFeature?: Value.Struct & {
    targeting_key?: string;
  };
  page?: {
    path: string;
    referrer: string;
    search: string;
    title: string;
    url: string;
  };
}
