import React from 'react';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Configuration, ResolveContext } from '@spotify-confidence/client-http';
import { useStringValue } from '@spotify-confidence/integration-react';
import { act, render, screen } from '@testing-library/react';
import { OpenFeatureNext12 } from './OpenFeatureNext12';

const TestComponent = () => {
  const str = useStringValue('test.str', 'default');
  return <p>{str}</p>;
};

describe('OpenFeatureNext12', () => {
  const fakeFetch = jest.fn();
  it('should put the serialized config into the client provider and configure it', async () => {
    const fakeContext: ResolveContext = {
      targeting_key: 'user-a',
    };
    const fakeSerializedProvider: Configuration.Serialized = {
      flags: {
        ['flags/test']: {
          flagName: 'flags/test',
          schema: {
            str: 'string',
          },
          reason: Configuration.ResolveReason.Match,
          value: { str: 'from serialized' },
          variant: 'control',
        },
      },
      context: fakeContext,
      resolveToken: '',
    };
    const clientProvider = createConfidenceWebProvider({
      clientSecret: 'none',
      region: 'eu',
      fetchImplementation: fakeFetch,
    });

    await act(() =>
      render(
        <>
          <OpenFeatureNext12.ClientSetup
            serializedConfig={fakeSerializedProvider}
            context={fakeContext}
            clientProvider={clientProvider}
            fallback={<p>fallback</p>}
          >
            <TestComponent />
          </OpenFeatureNext12.ClientSetup>
        </>,
      ),
    );

    expect(screen.getByText('from serialized')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
