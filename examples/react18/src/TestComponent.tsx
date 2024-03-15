import React from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { OpenFeature } from '@openfeature/web-sdk';
import { EventSender } from '@spotify-confidence/sdk';

export const TestComponent = (props: { eventSender: EventSender }) => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  const { eventSender } = props;
  return (
    <>
      <p>The string flag value is: {str}</p>
      <button
        onClick={() => {
          OpenFeature.setContext({ targetingKey: `user-${Math.random()}` });
          eventSender.sendEvent('eventDefinitions/navigate');
        }}
      >
        Randomise OpenFeature Context
      </button>
    </>
  );
};

export default TestComponent;
