import React from 'react';
import fetch from 'node-fetch';
import { OpenFeatureAPI, ProviderEvents } from '@openfeature/web-sdk';
import { act } from 'react-dom/test-utils';
import { render, screen } from '@testing-library/react';

import { createConfidenceWebProvider } from '@spotify-confidence/openfeature-web-provider';
import { useStringValue } from './ReactAdaptor';

const TestComponent = () => {
  const str = useStringValue('web-sdk-e2e-flag.str', 'set-in-test');

  return <p>{str}</p>;
};

const confidenceProvider = createConfidenceWebProvider({
  clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
  fetchImplementation: fetch as any,
  region: 'eu',
});

describe('ReactAdapter e2e', () => {
  it('should show suspense whilst loading then when the context is changed it should show control or treatment', async () => {
    const testScopeOpenFeature = OpenFeatureAPI.getInstance();

    const setProm = new Promise<void>(resolve => {
      testScopeOpenFeature.addHandler(ProviderEvents.Ready, () => resolve());
    });
    testScopeOpenFeature.setProvider(confidenceProvider);

    render(
      <React.Suspense fallback={<p>suspense</p>}>
        <TestComponent />
      </React.Suspense>,
    );

    expect(screen.getByText('suspense')).toBeInTheDocument();

    await act(async () => {
      await setProm;
      await testScopeOpenFeature.setContext({ targetingKey: 'user-a' });
    });

    expect(screen.getByText('control')).toBeInTheDocument();

    await act(async () => {
      return await testScopeOpenFeature.setContext({ targetingKey: 'user-ab' });
    });

    expect(screen.getByText('treatment')).toBeInTheDocument();
  });
});
