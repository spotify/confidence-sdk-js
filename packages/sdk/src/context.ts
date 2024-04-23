import { Value } from './Value';

export interface Contextual<Self extends Contextual<Self>> {
  getContext(): Context;
  setContext(context: Context): void;
  withContext(context: Context): Self;
  clearContext(): void;
}

type Brand = {
  brand: 'string';
  version: number;
};

export interface Context extends Value.Struct {
  visitor_id?: string;
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
