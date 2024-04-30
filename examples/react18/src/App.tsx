import React from 'react';
import { OpenFeature, OpenFeatureProvider } from '@openfeature/react-sdk';
import TestComponent from './TestComponent';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Confidence, pageViews } from '@spotify-confidence/sdk';
import { ConfidenceProvider } from './ConfidenceContext';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  region: 'eu',
  environment: 'client',
  timeout: 1000,
});

confidence.track(pageViews());

const webProvider = createConfidenceWebProvider(confidence);
OpenFeature.setProvider(webProvider);
function App() {
  return (
    <ConfidenceProvider confidence={confidence}>
      <h1>React 18 Example</h1>
      <OpenFeatureProvider>
        <div style={{ height: 2000 }}>
          <React.Suspense fallback={<p>Loading... </p>}>
            <TestComponent />
          </React.Suspense>
        </div>
        <p>bottom</p>
      </OpenFeatureProvider>
    </ConfidenceProvider>
  );
}

export default App;
