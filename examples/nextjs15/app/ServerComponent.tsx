import React, { FC, Suspense, use } from 'react';
import { fetchData } from './api';
import { useConfidence } from './confidence/server';

export const ServerComponent: FC<{ name?: string }> = ({ name = 'hawkeye' }) => {
  const confidence = useConfidence();
  // debugger;
  console.log('ServerComponent render');
  const pantsColor = confidence.getFlag('pantsColor', 'green').orSuspend();
  console.log('ServerComponent', pantsColor);
  //   const time = use(fetchData());
  return (
    <fieldset>
      <legend>ServerComponent</legend>
      <h1>Hello {pantsColor}</h1>
    </fieldset>
  );
};
