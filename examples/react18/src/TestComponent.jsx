import React from 'react';
import { useStringValue } from '@spotify-confidence/integration-react';

export const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  return <p>String value {str}</p>;
};

export default TestComponent;
