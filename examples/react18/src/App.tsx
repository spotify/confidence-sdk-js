import React, { useEffect } from 'react';
import { ClientProviderEvents, OpenFeature } from '@openfeature/web-sdk';
import TestComponent from './TestComponent';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Confidence, pageViews, webVitals } from '@spotify-confidence/sdk';
import { FetchBuilder } from '@spotify-confidence/client-http';
import { ConfidenceProvider } from './ConfidenceContext';

const fetchImplementation = new FetchBuilder()
  .route(
    url => url.endsWith('/events:publish'),
    async req => {
      const { events } = await req.json();
      // @ts-ignore
      for (const { eventDefinition, payload } of events) {
        console.log(eventDefinition.split('/')[1], payload);
      }
      return new Response(JSON.stringify({ errors: [] }));
    },
  )
  .build(fetch.bind(window));

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  region: 'eu',
  environment: 'client',
  fetchImplementation,
  timeout: 1000,
});

confidence.track(webVitals());

export const webProvider = createConfidenceWebProvider(confidence);

OpenFeature.getClient().addHandler(ClientProviderEvents.Ready, () => console.log('ready!'));
function App() {
  useEffect(() => {
    // OpenFeature.setContext({
    //   targetingKey: 'user-a',
    // });
    OpenFeature.setProvider(webProvider);
    // confidence.sendEvent('test');
  }, []);

  return (
    <ConfidenceProvider confidence={confidence}>
      <h1>React 18 Example</h1>
      <div style={{ height: 2000 }}>
        <React.Suspense fallback={<p>Loading... </p>}>
          <TestComponent />
        </React.Suspense>
      </div>
      <p>bottom</p>
    </ConfidenceProvider>
  );
}

export default App;
