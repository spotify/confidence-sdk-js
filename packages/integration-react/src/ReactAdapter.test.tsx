import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OpenFeatureClient, ProviderEvents } from '@openfeature/web-sdk';
import {
  useStringValue,
  FeaturesStore,
  FeatureStoreContext,
  useNumberValue,
  useObjectValue,
  useBooleanValue,
  useStringDetails,
  useNumberDetails,
  useObjectDetails,
  useBooleanDetails,
} from './ReactAdaptor';

const fakeClient = {
  getStringDetails: jest.fn(),
  getStringValue: jest.fn(),
  getBooleanValue: jest.fn(),
  getBooleanDetails: jest.fn(),
  getNumberValue: jest.fn(),
  getNumberDetails: jest.fn(),
  getObjectValue: jest.fn(),
  getObjectDetails: jest.fn(),
  addHandler: jest.fn(),
  removeHandler: jest.fn(),
} as jest.MockedObject<OpenFeatureClient>;

describe('hooks', () => {
  const handlerMap = new Map<ProviderEvents, Set<Function>>();
  const fire = (event: ProviderEvents) => {
    const handlers = handlerMap.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler();
      }
    }
  };

  beforeEach(() => {
    fakeClient.addHandler.mockImplementation((event, cb) => {
      let handlers = handlerMap.get(event);
      if (!handlers) handlerMap.set(event, (handlers = new Set()));
      handlers.add(cb);
    });
    fakeClient.removeHandler.mockImplementation((event, cb) => {
      const handlers = handlerMap.get(event);
      if (handlers) {
        handlers.delete(cb);
        if (handlers.size === 0) handlerMap.delete(event);
      }
    });
  });

  describe('resolve success', () => {
    it.each`
      hookUnderTest        | defaultValue                                      | mockValue                                    | name                   | mockFunc
      ${useStringValue}    | ${'default'}                                      | ${'mockVal'}                                 | ${'useStringValue'}    | ${fakeClient.getStringValue}
      ${useNumberValue}    | ${0}                                              | ${1}                                         | ${'useNumberValue'}    | ${fakeClient.getNumberValue}
      ${useBooleanValue}   | ${false}                                          | ${true}                                      | ${'useBooleanValue'}   | ${fakeClient.getBooleanValue}
      ${useObjectValue}    | ${{ val: 'default' }}                             | ${{ val: 'mock' }}                           | ${'useObjectValue'}    | ${fakeClient.getObjectValue}
      ${useStringDetails}  | ${{ value: 'default', reason: 'DEFAULT' }}        | ${{ value: 'mock', reason: 'MATCH' }}        | ${'useStringDetails'}  | ${fakeClient.getStringDetails}
      ${useNumberDetails}  | ${{ value: 0, reason: 'DEFAULT' }}                | ${{ value: 1, reason: 'MATCH' }}             | ${'useNumberDetails'}  | ${fakeClient.getNumberDetails}
      ${useBooleanDetails} | ${{ value: false, reason: 'DEFAULT' }}            | ${{ value: true, reason: 'MATCH' }}          | ${'useBooleanDetails'} | ${fakeClient.getBooleanDetails}
      ${useObjectDetails}  | ${{ value: { t: 'default' }, reason: 'DEFAULT' }} | ${{ value: { t: 'mock' }, reason: 'MATCH' }} | ${'useObjectDetails'}  | ${fakeClient.getObjectDetails}
    `(
      `($name): should show suspense until the value is resolved, and cleanup`,
      async ({ hookUnderTest, defaultValue, mockValue, mockFunc }) => {
        mockFunc.mockReturnValue(mockValue);
        const TestComponent = () => {
          const val = hookUnderTest('flag', defaultValue);
          return <p>{JSON.stringify(val)}</p>;
        };

        const featureStore = FeaturesStore.forClient(fakeClient);

        const { unmount } = render(
          <FeatureStoreContext.Provider value={featureStore}>
            <React.Suspense fallback={<p>suspense</p>}>
              <TestComponent />
            </React.Suspense>
          </FeatureStoreContext.Provider>,
        );

        expect(screen.getByText('suspense')).toBeInTheDocument();

        fire(ProviderEvents.Ready);

        expect(await screen.findByText(JSON.stringify(mockValue))).toBeInTheDocument();

        unmount();

        expect(handlerMap.size).toBe(0);
      },
    );
  });

  describe('re-resolve', () => {
    it.each`
      hookUnderTest        | defaultValue                                      | mockValue1                                   | mockValue2                                    | name                   | mockFunc
      ${useStringValue}    | ${'default'}                                      | ${'mockVal'}                                 | ${'mockVal2'}                                 | ${'useStringValue'}    | ${fakeClient.getStringValue}
      ${useNumberValue}    | ${0}                                              | ${1}                                         | ${2}                                          | ${'useNumberValue'}    | ${fakeClient.getNumberValue}
      ${useBooleanValue}   | ${false}                                          | ${true}                                      | ${false}                                      | ${'useBooleanValue'}   | ${fakeClient.getBooleanValue}
      ${useObjectValue}    | ${{ val: 'default' }}                             | ${{ val: 'mock' }}                           | ${{ val: 'mock2' }}                           | ${'useObjectValue'}    | ${fakeClient.getObjectValue}
      ${useStringDetails}  | ${{ value: 'default', reason: 'DEFAULT' }}        | ${{ value: 'mock', reason: 'MATCH' }}        | ${{ value: 'mock2', reason: 'MATCH' }}        | ${'useStringDetails'}  | ${fakeClient.getStringDetails}
      ${useNumberDetails}  | ${{ value: 0, reason: 'DEFAULT' }}                | ${{ value: 1, reason: 'MATCH' }}             | ${{ value: 2, reason: 'MATCH' }}              | ${'useNumberDetails'}  | ${fakeClient.getNumberDetails}
      ${useBooleanDetails} | ${{ value: false, reason: 'DEFAULT' }}            | ${{ value: true, reason: 'MATCH' }}          | ${{ value: false, reason: 'MATCH' }}          | ${'useBooleanDetails'} | ${fakeClient.getBooleanDetails}
      ${useObjectDetails}  | ${{ value: { t: 'default' }, reason: 'DEFAULT' }} | ${{ value: { t: 'mock' }, reason: 'MATCH' }} | ${{ value: { t: 'mock2' }, reason: 'MATCH' }} | ${'useObjectDetails'}  | ${fakeClient.getObjectDetails}
    `(
      `($name): should show suspense until the value is resolved and reload when the context is changed, show new value and cleanup`,
      async ({ hookUnderTest, defaultValue, mockValue1, mockValue2, mockFunc }) => {
        mockFunc.mockReturnValue(mockValue1);
        const TestComponent = () => {
          const val = hookUnderTest('flag', defaultValue);
          return <p>{JSON.stringify(val)}</p>;
        };

        const featureStore = FeaturesStore.forClient(fakeClient);

        const { unmount } = render(
          <FeatureStoreContext.Provider value={featureStore}>
            <React.Suspense fallback={<p>suspense</p>}>
              <TestComponent />
            </React.Suspense>
          </FeatureStoreContext.Provider>,
        );

        expect(screen.getByText('suspense')).toBeInTheDocument();

        fire(ProviderEvents.Ready);

        expect(await screen.findByText(JSON.stringify(mockValue1))).toBeInTheDocument();

        act(() => {
          fire(ProviderEvents.Stale);
          mockFunc.mockReturnValue(mockValue2);
          fire(ProviderEvents.Ready);
        });

        expect(await screen.findByText(JSON.stringify(mockValue2))).toBeInTheDocument();

        unmount();

        expect(handlerMap.size).toBe(0);
      },
    );
  });

  describe('resolve error', () => {
    it.each`
      hookUnderTest        | defaultValue                                      | name                   | mockFunc
      ${useStringValue}    | ${'default'}                                      | ${'useStringValue'}    | ${fakeClient.getStringValue}
      ${useNumberValue}    | ${0}                                              | ${'useNumberValue'}    | ${fakeClient.getNumberValue}
      ${useBooleanValue}   | ${false}                                          | ${'useBooleanValue'}   | ${fakeClient.getBooleanValue}
      ${useObjectValue}    | ${{ val: 'default' }}                             | ${'useObjectValue'}    | ${fakeClient.getObjectValue}
      ${useStringDetails}  | ${{ value: 'default', reason: 'DEFAULT' }}        | ${'useStringDetails'}  | ${fakeClient.getStringDetails}
      ${useNumberDetails}  | ${{ value: 0, reason: 'DEFAULT' }}                | ${'useNumberDetails'}  | ${fakeClient.getNumberDetails}
      ${useBooleanDetails} | ${{ value: false, reason: 'DEFAULT' }}            | ${'useBooleanDetails'} | ${fakeClient.getBooleanDetails}
      ${useObjectDetails}  | ${{ value: { t: 'default' }, reason: 'DEFAULT' }} | ${'useObjectDetails'}  | ${fakeClient.getObjectDetails}
    `(`($name): should show suspense then default, and cleanup`, async ({ hookUnderTest, defaultValue, mockFunc }) => {
      mockFunc.mockReturnValue(defaultValue);
      const TestComponent = () => {
        const val = hookUnderTest('flag', defaultValue);
        return <p>{JSON.stringify(val)}</p>;
      };

      const featureStore = FeaturesStore.forClient(fakeClient);

      const { unmount } = render(
        <FeatureStoreContext.Provider value={featureStore}>
          <React.Suspense fallback={<p>suspense</p>}>
            <TestComponent />
          </React.Suspense>
        </FeatureStoreContext.Provider>,
      );

      expect(screen.getByText('suspense')).toBeInTheDocument();

      act(() => {
        fire(ProviderEvents.Error);
      });

      expect(await screen.findByText(JSON.stringify(defaultValue))).toBeInTheDocument();

      unmount();

      expect(handlerMap.size).toBe(0);
    });
  });
});
