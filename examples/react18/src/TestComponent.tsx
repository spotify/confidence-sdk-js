import React from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { OpenFeature } from '@openfeature/web-sdk';

export const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  return (
    <>
      <p>I am in the client {str}</p>
      <button
        onClick={() => {
          OpenFeature.setContext({ targetingKey: 'user-a', random: Math.random() });
        }}
      >
        Random context
      </button>
    </>
  );
};

export default TestComponent;
