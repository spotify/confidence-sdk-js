import React, { useEffect } from 'react';
import { OpenFeature } from '@openfeature/web-sdk';
import { webProvider } from './client-provider';
import TestComponent from './TestComponent';

function App() {
  useEffect(() => {
    OpenFeature.setContext({
      targetingKey: 'user-a',
    }).then(() => {
      OpenFeature.setProvider(webProvider);
    });
  }, []);

  return (
    <React.Suspense fallback={<p>Loading... </p>}>
      <TestComponent />
    </React.Suspense>
  );
}

export default App;
