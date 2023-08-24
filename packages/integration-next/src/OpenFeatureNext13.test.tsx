import React from 'react';
import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { Configuration, ResolveContext } from '@spotify-confidence/client-http';
import { useStringValue } from '@spotify-confidence/integration-react';
import { act, render, screen } from '@testing-library/react';
import { OpenFeatureNext13 } from './OpenFeatureNext13';

const TestComponent = () => {
  const str = useStringValue('test.str', 'default');
  return <p>{str}</p>;
};

describe('OpenFeatureNext13', () => {
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
          <OpenFeatureNext13.ClientSetup
            serializedConfig={fakeSerializedProvider}
            context={fakeContext}
            clientProvider={clientProvider}
          />
          <TestComponent />
        </>,
      ),
    );

    expect(screen.getByText('from serialized')).toBeInTheDocument();
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});
