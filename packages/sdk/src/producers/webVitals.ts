import { onLCP, onFID, onCLS, LCPMetric, FIDMetric, CLSMetric } from 'web-vitals';
import { createProducer } from '../events';

type Metric = LCPMetric | FIDMetric | CLSMetric;

export type WebVitalsOptions = {
  lcp?: boolean;
  fid?: boolean;
  cls?: boolean;
};

export function webVitals({ lcp = true, fid = true, cls = true }: WebVitalsOptions = {}) {
  return createProducer(emit => {
    const handleMetric = ({ name, id, delta }: Metric) => {
      emit({
        [`web-vital-${name.toLowerCase()}`]: {
          id,
          delta,
        },
      });
    };

    if (lcp) onLCP(handleMetric);
    if (fid) onFID(handleMetric);
    if (cls) onCLS(handleMetric);
  });
}
