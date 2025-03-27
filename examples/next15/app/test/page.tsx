import { cache, FC, ReactElement, ReactNode, Suspense } from 'react';
import { DeepClient, TestClient, Wrapper } from './client';
import { Cache } from './dating-cache';
import { OnceRendered, render } from './util';

const JsonCache = Cache.forCodec(JSON);

const getCache = cache(() => new JsonCache());

const supplier = async (key: string) => {
  await sleep(key.length * 1000);
  return key.length;
};

const registry = new FinalizationRegistry(() => {
  console.log('finalized cache!!!');
});
export default async function Page() {
  console.log('Test render');
  const cache = getCache();
  registry.register(cache, undefined);

  return (
    <Outer>
      <div>Some unsuspended stuff</div>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <TestClient name="one" />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <TestClient name="deep" />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <Test name="one" />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <Deep />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <Test name="two" />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <Test name="sloooow" />
      </Suspense>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <DeepClient>
          <Test name="three" />
        </DeepClient>
      </Suspense>
    </Outer>
  );
}

const Outer: FC<{ children?: ReactNode }> = async ({ children }) => {
  console.log('render outer');
  const cache = getCache();
  cache.ref();

  const Trailer = () => {
    cache.unref();
    return undefined;
  };
  return (
    <Wrapper data={cache}>
      {children}
      <Trailer />
    </Wrapper>
    // <OnceRendered callback={() => cache.unref()}>
    // </OnceRendered>
  );
};

const Deep: FC = async () => {
  console.log('render deep wrapper');
  await sleep(1000);
  console.log('deep wrapper move on');
  return <Test name="deep" />;
};
const Test: FC<{ name: string; children?: ReactNode }> = async ({ name, children }) => {
  console.log('render', name);
  const cache = getCache();
  const v = await cache.get(name, supplier);
  // await sleep(1000);
  return (
    <fieldset>
      <legend>Test ({`${name}:${v}`})</legend>
      {children}
    </fieldset>
  );
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
