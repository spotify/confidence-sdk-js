'use client';

import React, { ReactNode, createContext, use } from 'react';
import { Cache } from './dating-cache';

const JsonCache = Cache.forCodec(JSON);
const CacheProvider = createContext<Cache<any> | null>(null);
const supplier = async (key: string) => {
  console.log('CLIENT RESOLVE!!!!!!!!!!!!!!!!!!!!!!!', key);
  await sleep(500);
  return key.length;
};

export function useCache() {
  const cache = React.useContext(CacheProvider);
  if (!cache) {
    throw new Error('No Cache instance found, did you forget to wrap your component in CacheProvider?');
  }
  return cache;
}

export function Wrapper(props: { children: ReactNode; data: AsyncIterable<[string, string]> }) {
  console.log('render wrapper');
  const cache = new JsonCache(spy(props.data, 'loaded'));
  return (
    <CacheProvider value={cache}>
      {/* <label>things: {things.join(',')}</label> */}
      {props.children}
    </CacheProvider>
  );
}

export function DeepClient(props: { children?: ReactNode }) {
  return <div>{props.children}</div>;
}

export function TestClient(props: { name: string; children?: ReactNode }) {
  console.log('render (client)', props.name);
  const cache = useCache();
  const v = use(cache.get(props.name, supplier));
  // await sleep(1000);
  return (
    <fieldset>
      <legend>TestClient ({`${props.name}:${v}`})</legend>
      {props.children}
    </fieldset>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function* spy<T>(it: AsyncIterable<T>, prefix = 'spy', done = 'done'): AsyncIterable<T> {
  for await (const value of it) {
    console.log(prefix, value);
    yield value;
  }
  console.log(done);
}
