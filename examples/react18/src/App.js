import React, {useEffect} from 'react';
import {OpenFeature} from "@openfeature/web-sdk";
import {webProvider} from "./client-provider";
import TestComponent from "./TestComponent";

OpenFeature.setProvider(webProvider);

function App() {
  useEffect(() => {
    OpenFeature.setContext({
      targetingKey: 'myTargetingKey',
    });
  }, []);

  return (
      <React.Suspense fallback={<p>Loading... </p>}>
        <TestComponent />
      </React.Suspense>
  );
}

export default App;
