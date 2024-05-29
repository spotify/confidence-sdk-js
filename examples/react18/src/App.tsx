import React from 'react';
import TestComponent from './TestComponent';
import { Confidence, pageViews } from '@spotify-confidence/sdk';
import { ConfidenceProvider } from '@spotify-confidence/react-helpers';

const confidence = Confidence.create({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  region: 'eu',
  environment: 'react',
  timeout: 1000,
  logger: console,
});

confidence.track(pageViews());

function App() {
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
