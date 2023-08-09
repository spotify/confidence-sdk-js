import React, { EffectCallback, createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  Client,
  EvaluationDetails,
  EventHandler,
  JsonValue,
  OpenFeature,
  ProviderEvents,
  ResolutionDetails,
} from '@openfeature/web-sdk';

type SetState = () => void;

export class ClientManager {
  private readonly onReady: EventHandler<ProviderEvents>;
  private readonly onStale: EventHandler<ProviderEvents>;
  private readonly onError: EventHandler<ProviderEvents>;
  public readonly effect: EffectCallback;
  private references: number = 0;
  promise?: Promise<void>;
  private onChangeHandlers: Set<SetState> = new Set();

  constructor(private readonly instance: Client) {
    const resolves = [this.createPromise()];

    this.onReady = this.onError = () => {
      resolves.pop()?.();
      if (resolves.length === 0) {
        this.promise = undefined;
      }
      for (const cb of this.onChangeHandlers) {
        try {
          cb();
        } catch (e) {
          // do nothing
        }
      }
    };
    this.onStale = () => {
      resolves.unshift(this.createPromise());
    };

    this.effect = () => {
      this.ref();
      return () => {
        this.unref();
      };
    };
  }

  addOnChangeHandler(callback: SetState) {
    this.onChangeHandlers.add(callback);
  }

  removeOnChangeHandler(callback: SetState) {
    this.onChangeHandlers.delete(callback);
  }

  getClient(): Client {
    if (this.promise) {
      throw this.promise;
    }
    return this.instance;
  }

  public ref() {
    if (this.references++ === 0) {
      this.instance.addHandler(ProviderEvents.Error, this.onError);
      this.instance.addHandler(ProviderEvents.Ready, this.onReady);
      this.instance.addHandler(ProviderEvents.Stale, this.onStale);
    }
  }

  public unref() {
    if (--this.references === 0) {
      this.instance.removeHandler(ProviderEvents.Error, this.onError);
      this.instance.removeHandler(ProviderEvents.Ready, this.onReady);
      this.instance.removeHandler(ProviderEvents.Stale, this.onStale);
    }
  }

  private createPromise(): () => void {
    let resolver: () => void;
    this.promise = new Promise(resolve => {
      resolver = resolve;
    });
    return () => {
      resolver?.();
    };
  }
}

let defaultClientManager: ClientManager | undefined;

// exported for tests
export const ClientManagerContext = createContext<() => ClientManager>(() => {
  if (!defaultClientManager) {
    defaultClientManager = new ClientManager(OpenFeature.getClient());
    defaultClientManager.ref();
  }
  return defaultClientManager;
});

type OpenFeatureContextProviderProps = {
  name: string;
};
export const OpenFeatureContextProvider: React.FC<React.PropsWithChildren<OpenFeatureContextProviderProps>> = ({
  children,
  name,
}) => {
  const manager = useMemo(() => new ClientManager(OpenFeature.getClient(name)), [name]);
  useEffect(() => manager.effect(), [manager]);

  return <ClientManagerContext.Provider value={() => manager}>{children}</ClientManagerContext.Provider>;
};

export function useStringValue(flagKey: string, defaultValue: string): string {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getStringValue(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getStringValue(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useStringDetails(flagKey: string, defaultValue: string): ResolutionDetails<string> {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getStringDetails(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getStringDetails(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useBooleanValue(flagKey: string, defaultValue: boolean): boolean {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getBooleanValue(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getBooleanValue(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useBooleanDetails(flagKey: string, defaultValue: boolean): ResolutionDetails<boolean> {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getBooleanDetails(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getBooleanDetails(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useNumberValue(flagKey: string, defaultValue: number): number {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getNumberValue(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getNumberValue(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useNumberDetails(flagKey: string, defaultValue: number): EvaluationDetails<number> {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getNumberDetails(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getNumberDetails(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value;
}

export function useObjectValue<T extends JsonValue>(flagKey: string, defaultValue: T): T {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getObjectValue(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getObjectValue(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value as T;
}

export function useObjectDetails<T extends JsonValue>(flagKey: string, defaultValue: T): EvaluationDetails<T> {
  const manager = useContext(ClientManagerContext)();
  const client = manager.getClient();
  const [value, setValue] = useState(() => client.getObjectDetails(flagKey, defaultValue));

  useEffect(() => {
    const callback = () => setValue(client.getObjectDetails(flagKey, defaultValue));
    manager.addOnChangeHandler(callback);
    return () => {
      manager.removeOnChangeHandler(callback);
    };
  }, [defaultValue, flagKey, manager, client]);

  return value as EvaluationDetails<T>;
}
