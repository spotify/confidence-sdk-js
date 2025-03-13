import { cache, FC, ReactNode, Suspense } from 'react';
import { DeepClient, Wrapper } from './client';
import { Things } from './thing';

const getThings: () => Things = cache(() => new Things());

export default async function Page() {
  console.log('Test render');
  return (
    <Outer>
      <Suspense fallback={<fieldset>Loading...</fieldset>}>
        <Test name="one" />
        <Deep />
        <Test name="two" />
        <DeepClient>
          <Test name="three" />
        </DeepClient>
      </Suspense>
    </Outer>
  );
}

const Trailer: FC = () => {
  console.log('render trailer');
  getThings().close();
  return undefined;
};

const Outer: FC<{ children?: ReactNode }> = async ({ children }) => {
  const things = getThings();
  return (
    <Wrapper things={Things.collect(things)}>
      {children}
      <Trailer />
    </Wrapper>
  );
};

const Deep: FC = () => {
  return <Test name="deep" />;
};
const Test: FC<{ name: string; children?: ReactNode }> = async ({ name, children }) => {
  console.log('render', name);
  getThings().put(name);
  // await sleep(1000);
  return (
    <fieldset>
      <legend>Test</legend>
      {children}
    </fieldset>
  );
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
