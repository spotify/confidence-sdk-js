import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { OpenFeatureClient, ProviderEvents } from '@openfeature/web-sdk';
import {
  useStringValue,
  ClientManager,
  ClientManagerContext,
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
  let fireReady: Function | undefined;
  let fireError: Function | undefined;
  let fireStale: Function | undefined;

  beforeEach(() => {
    fakeClient.addHandler.mockImplementation((event, cb) => {
      if (event === ProviderEvents.Error) {
        fireError = cb;
      }
      if (event === ProviderEvents.Stale) {
        fireStale = cb;
      }
      if (event === ProviderEvents.Ready) {
        fireReady = cb;
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

        const manager = new ClientManager(fakeClient);
        manager.ref();

        const { unmount } = render(
          <ClientManagerContext.Provider value={() => manager}>
            <React.Suspense fallback={<p>suspense</p>}>
              <TestComponent />
            </React.Suspense>
          </ClientManagerContext.Provider>,
        );

        expect(screen.getByText('suspense')).toBeInTheDocument();

        await act(async () => {
          fireReady!();
          await manager.promise;
        });

        expect(screen.getByText(JSON.stringify(mockValue))).toBeInTheDocument();

        unmount();

        manager.unref();
        expect(fakeClient.addHandler).toBeCalledTimes(3);
        expect(fakeClient.removeHandler).toBeCalledTimes(3);
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
        mockFunc.mockReturnValueOnce(mockValue1).mockReturnValueOnce(mockValue2);
        const TestComponent = () => {
          const val = hookUnderTest('flag', defaultValue);
          return <p>{JSON.stringify(val)}</p>;
        };

        const manager = new ClientManager(fakeClient);
        manager.ref();

        const { unmount } = render(
          <ClientManagerContext.Provider value={() => manager}>
            <React.Suspense fallback={<p>suspense</p>}>
              <TestComponent />
            </React.Suspense>
          </ClientManagerContext.Provider>,
        );

        expect(screen.getByText('suspense')).toBeInTheDocument();

        await act(async () => {
          fireReady!();
          await manager.promise;
        });

        expect(screen.getByText(JSON.stringify(mockValue1))).toBeInTheDocument();

        await act(async () => {
          fireStale!();
          fireReady!();
        });

        expect(screen.getByText(JSON.stringify(mockValue2))).toBeInTheDocument();

        unmount();

        manager.unref();
        expect(fakeClient.addHandler).toBeCalledTimes(3);
        expect(fakeClient.removeHandler).toBeCalledTimes(3);
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

      const manager = new ClientManager(fakeClient);
      manager.ref();

      const { unmount } = render(
        <ClientManagerContext.Provider value={() => manager}>
          <React.Suspense fallback={<p>suspense</p>}>
            <TestComponent />
          </React.Suspense>
        </ClientManagerContext.Provider>,
      );

      expect(screen.getByText('suspense')).toBeInTheDocument();

      await act(async () => {
        fireError!();
        await manager.promise;
      });

      expect(screen.getByText(JSON.stringify(defaultValue))).toBeInTheDocument();

      unmount();

      manager.unref();
      expect(fakeClient.addHandler).toBeCalledTimes(3);
      expect(fakeClient.removeHandler).toBeCalledTimes(3);
    });
  });
});
