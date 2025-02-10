'use client';

import React, { FC, ReactNode, use, useEffect, useState } from 'react';
import { useConfidence } from './confidence/client';

export const ClientComponent: FC<{ children?: ReactNode }> = ({ children }) => {
  console.log('ClientComponent render');
  const pantsColor = useConfidence().getFlag('pantsColor', 'green').orSuspend();
  const onClick = () => {
    console.log('clicked');
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
