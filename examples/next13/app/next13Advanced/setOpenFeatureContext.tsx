'use client';

import { EvaluationContext, OpenFeature } from '@openfeature/web-sdk';
import { provider } from '@/utils/clientProvider';

export const SetOpenFeatureContext = (props: React.PropsWithChildren<{ context: EvaluationContext }>) => {
  OpenFeature.setContext(props.context);
  if (provider) {
    OpenFeature.setProvider(provider);
  }
  return <></>;
};
