'use client';

import React, { FC, ReactNode, use, useEffect, useState } from 'react';
import { useConfidence, useFlag } from './confidence/client';

export const ClientComponent: FC<{ children?: ReactNode }> = ({ children }) => {
  console.log('ClientComponent render');
  const confidence = useConfidence();
  const pantsColor = useFlag('pantsColor', 'green');
  const onClick = () => {
    console.log('clicked');
    confidence.setContext({ userId: 'nicky' });
  };

  return (
    <fieldset>
      <legend>ClientComponent</legend>
      <h1 onClick={onClick}>Hello {pantsColor}</h1>
      {/* <ServerComponent name={name} /> */}
      {children}
    </fieldset>
  );
};
