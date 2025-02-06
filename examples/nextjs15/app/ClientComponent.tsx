'use client';
/* eslint-disable no-console */
import React, { FC, ReactNode, use, useEffect, useState } from 'react';
import { ServerComponent } from './ServerComponent';

export const ClientComponent: FC<{ children?: ReactNode }> = ({ children }) => {
  console.log('rendering client component..........');
  const [name, setName] = useState('world');
  useEffect(() => {
    console.log('client effect');
    setTimeout(() => {
      setName('hawkeye!');
    }, 1000);
  }, [setName]);
  return (
    <div>
      <h1>Hello client</h1>
      {/* <ServerComponent name={name} /> */}
      {children}
    </div>
  );
};
