'use client';

import React, { ReactNode, use } from 'react';

export function Wrapper(props: { things: PromiseLike<string[]>; children: ReactNode }) {
  console.log('render wrapper');
  const things = use(props.things);
  return (
    <fieldset>
      <label>things: {things.join(',')}</label>
      {props.children}
    </fieldset>
  );
}

export function DeepClient(props: { children?: ReactNode }) {
  return <div>{props.children}</div>;
}

async function collectThings<T>(it: AsyncIterable<T>): Promise<T[]> {
  const things = [];
  for await (const thing of it) {
    things.push(thing);
  }
  return things;
}
