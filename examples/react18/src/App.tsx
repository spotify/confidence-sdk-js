import React, { useEffect } from 'react';
import { ClientProviderEvents, OpenFeature } from '@openfeature/web-sdk';
import TestComponent from './TestComponent';
import { Confidence } from '@spotify-confidence/sdk';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  environment: 'client',
  timeout: 1000,
});

export const webProvider = createConfidenceWebProvider(confidence);

OpenFeature.getClient().addHandler(ClientProviderEvents.Ready, () => console.log('ready!'));
function App() {
  useEffect(() => {
    OpenFeature.setContext({
      targetingKey: 'user-a',
    });
    OpenFeature.setProvider(webProvider);
  }, []);

  confidence.updateContext("page", "testComponent");

  return (
    <>
      <h1>React 18 Example</h1>
      <React.Suspense fallback={<p>Loading... </p>}>
        <TestComponent eventSender={confidence}/>
      </React.Suspense>
    </>
  );
}

export default App;
