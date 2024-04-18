import React from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';
import { OpenFeature } from '@openfeature/web-sdk';
import { useConfidence, withContext } from './ConfidenceContext';

const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');
  const confidence = useConfidence();
  return (
    <>
      <p>The string flag value is: {str}</p>
      <button
        onClick={() => {
          OpenFeature.setContext({ targetingKey: `user-${Math.random()}` });
          confidence.sendEvent('click');
          confidence.close();
        }}
      >
        Randomize OpenFeature Context
      </button>
      <p>
        // TODO wrap this amazing new kitten feature in a feature flag so it doesn't show up in production
        <img src="https://thepetshow.com/wp-content/uploads/2015/07/lion-mirror.jpg" alt="confident kitten" />
      </p>
    </>
  );
};

export default withContext({ component: 'TestComponent' })(TestComponent);
