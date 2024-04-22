import {
  onLCP,
  onINP,
  onCLS,
  onTTFB,
  type LCPMetric,
  type INPMetric,
  type CLSMetric,
  type TTFBMetric,
} from 'web-vitals';
import { EventProducer } from '../events';
import { type Confidence } from '../Confidence';

type Metric = LCPMetric | INPMetric | CLSMetric | TTFBMetric;

type WebVitalsMetricMessage = {
  metric_id: string;
  metric_delta: number;
};
declare module '../events' {
  export interface Event {
    'web-vitals-lcp'?: WebVitalsMetricMessage;
    'web-vitals-inp'?: WebVitalsMetricMessage;
    'web-vitals-cls'?: WebVitalsMetricMessage;
    'web-vitals-ttfb'?: WebVitalsMetricMessage;
  }
}

/**
 * Options defining which Web Vital metrics to emit. By default all core metrics will be emitted.
 * @public
 */
export type WebVitalsOptions = {
  /**
   * Measure Largest Contentful Paint
   * @defaultValue true
   */
  lcp?: boolean;

  /**
   * Measure Interaction Next Paint
   * @defaultValue true
   */
  inp?: boolean;

  /**
   * Measure Cumulative Layout Shift
   * @defaultValue true
   */
  cls?: boolean;

  /**
   * Measure Time To First Byte
   * @defaultValue true
   */
  ttfb?: boolean;
};

/**
 * Emit {@link https://web.dev/articles/vitals | Web Vitals} metric events.
 *
 * @param options - specifying which metrics to emit
 * @returns a {@link EventProducer} to be used with {@link Confidence.track }
 * @public
 */
export function webVitals({ lcp = true, inp = true, cls = true, ttfb = false }: WebVitalsOptions = {}): EventProducer {
  return confidence => {
    const handleMetric = ({ name, id, delta }: Metric) => {
      if (confidence.isClosed) return;
      // TODO consider this example https://www.npmjs.com/package/web-vitals#send-attribution-data. Should we have some metric event?
      const metricKey = name.toLocaleLowerCase() as 'lcp' | 'inp' | 'cls' | 'ttfb';
      const eventName = `web-vitals-${metricKey}` as const;
      confidence.sendEvent(eventName, {
        metric_id: id,
        metric_delta: delta,
      });
    };
    if (lcp) onLCP(handleMetric);
    if (inp) onINP(handleMetric);
    if (cls) onCLS(handleMetric);
    if (ttfb) onTTFB(handleMetric);
  };
}
