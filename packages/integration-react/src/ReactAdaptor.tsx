import React, { createContext, useContext, useMemo } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import {
  Client,
  EvaluationDetails,
  Features,
  JsonValue,
  OpenFeature,
  ProviderEvents,
  ResolutionDetails,
} from '@openfeature/web-sdk';

export type FeaturesStore = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => Features;
};

export namespace FeaturesStore {
  export function forClient(client: Client, isReady = false): FeaturesStore {
    let [readyPromise, resolveReady] = createPromise();

    if (isReady) resolveReady();

    const onReadyOrError = () => {
      isReady = true;
      resolveReady();
      for (const handler of changeHandlers) {
        handler();
      }
    };

    const onStale = () => {
      isReady = false;
      [readyPromise, resolveReady] = createPromise();
    };

    const changeHandlers = new Set<() => void>();

    const subscribe = (onChange: () => void) => {
      if (changeHandlers.has(onChange)) throw new Error('Already subscribed');
      changeHandlers.add(onChange);
      if (changeHandlers.size == 1) {
        client.addHandler(ProviderEvents.Ready, onReadyOrError);
        client.addHandler(ProviderEvents.Error, onReadyOrError);
        client.addHandler(ProviderEvents.Stale, onStale);
      }
      return () => {
        if (!changeHandlers.has(onChange)) throw new Error('Already unsubscribed');
        changeHandlers.delete(onChange);
        if (changeHandlers.size == 0) {
          client.removeHandler(ProviderEvents.Ready, onReadyOrError);
          client.removeHandler(ProviderEvents.Error, onReadyOrError);
          client.removeHandler(ProviderEvents.Stale, onStale);
        }
      };
    };
    const getSnapshot = () => {
      if (!isReady) {
        readyPromise.then(subscribe(() => {}));
        throw readyPromise;
      }
      return client;
    };

    return { subscribe, getSnapshot };
  }
}

// Maybe this is not a good idea? Keeping whatever client was here as default?
const defaultFeatureStore = FeaturesStore.forClient(OpenFeature.getClient());

export const FeatureStoreContext = createContext(defaultFeatureStore);

type OpenFeatureContextProviderProps = {
  client?: Client;
  providerReady?: boolean;
};
export const OpenFeatureContextProvider: React.FC<React.PropsWithChildren<OpenFeatureContextProviderProps>> = props => {
  const { client = OpenFeature.getClient(), children } = props;
  const featuresStore = useMemo(() => FeaturesStore.forClient(client), [client]);

  return <FeatureStoreContext.Provider value={featuresStore}>{children}</FeatureStoreContext.Provider>;
};

export function useStringValue(flagKey: string, defaultValue: string): string {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getStringValue(flagKey, defaultValue));
}

export function useStringDetails(flagKey: string, defaultValue: string): ResolutionDetails<string> {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getStringDetails(flagKey, defaultValue));
}

export function useBooleanValue(flagKey: string, defaultValue: boolean): boolean {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getBooleanValue(flagKey, defaultValue));
}

export function useBooleanDetails(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getBooleanDetails(flagKey, defaultValue));
}

export function useNumberValue(flagKey: string, defaultValue: number): number {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getNumberValue(flagKey, defaultValue));
}

export function useNumberDetails(flagKey: string, defaultValue: number): EvaluationDetails<number> {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getNumberDetails(flagKey, defaultValue));
}

export function useObjectValue<T extends JsonValue>(flagKey: string, defaultValue: T): T {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getObjectValue<T>(flagKey, defaultValue));
}

export function useObjectDetails<T extends JsonValue>(flagKey: string, defaultValue: T): EvaluationDetails<T> {
  const store = useContext(FeatureStoreContext);
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().getObjectDetails<T>(flagKey, defaultValue));
}

function createPromise<T = void>(): [Promise<T>, (value: T) => void, (reason: any) => void] {
  let promise, resolve: (value: T) => void, reject: (reason: any) => void;
  promise = new Promise<T>((...args) => {
    [resolve, reject] = args;
  });
  return [promise, resolve!, reject!];
}
