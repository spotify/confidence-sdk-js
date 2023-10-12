import React from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { OpenFeature } from '@openfeature/web-sdk';

export const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  return (
    <>
      <p>The string flag value is: {str}</p>
      <button
        onClick={() => {
          OpenFeature.setContext({ targetingKey: `user-${Math.random()}` });
        }}
      >
        Randomise OpenFeature Context
      </button>
    </>
  );
};

export default TestComponent;
