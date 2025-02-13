'use client';

import React, { FC, ReactNode, use, useCallback, useEffect, useState } from 'react';
import { useConfidence, useFlag } from './confidence/client';
import { Context } from './confidence';

export const ClientComponent: FC<{ children?: ReactNode; setRole: (role: string) => void }> = ({
  setRole,
  children,
}) => {
  console.log('ClientComponent render');
  const confidence = useConfidence();
  const pantsColor = useFlag('pantsColor', 'green');
  const makeUser = useCallback(() => {
    setRole('user');
  }, []);
  const makeAdmin = useCallback(() => {
    setRole('admin');
  }, []);

  return (
    <fieldset>
      <legend>ClientComponent</legend>
      <h1>Hello {pantsColor}</h1>
      <button onClick={makeAdmin}>Make admin</button>
      <button onClick={makeUser}>Make user</button>
      {children}
    </fieldset>
  );
};
