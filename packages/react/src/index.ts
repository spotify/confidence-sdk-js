'use client';

import { createContext, createElement, useCallback, useContext, useEffect, useMemo } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { FlagBundle, publishFlagEvaluation } from '@spotify-confidence/sdk';

/** Exposure transport supplied by the application. Throw/reject or return ok:false on failure. */
export type Apply = (
  flagName: string,
) => void | { ok: boolean; errorMessage?: string } | Promise<void | { ok: boolean; errorMessage?: string }>;

export interface ConfidenceProviderProps {
  /** Immutable resolved snapshot. Replace it when the targeting context changes. */
  bundle: FlagBundle;
  /** Bound to this bundle's token; may call the thin client, an endpoint, or a server action. */
  apply: Apply;
  children?: ReactNode;
  /** Receives automatic exposure failures. Defaults to console.warn. Manual expose() rejects instead. */
  onExposureError?: (error: Error) => void;
}

interface ContextValue extends ConfidenceProviderProps {
  exposures: Map<string, Promise<void>>;
}

const Context = createContext<ContextValue | undefined>(undefined);
const missingBundle: FlagBundle = {
  flags: {},
  resolveId: '',
  resolveToken: '',
  errorCode: 'GENERAL',
  errorMessage: 'No ConfidenceProvider found',
};

/** Provides a resolved snapshot without fetching or exposing flags during render. */
export function ConfidenceProvider({
  bundle,
  apply,
  children,
  onExposureError,
}: ConfidenceProviderProps): ReactElement {
  // A new immutable snapshot starts a new exposure scope, even if resolveId is empty.
  const snapshot = useMemo(() => ({ bundle, exposures: new Map<string, Promise<void>>() }), [bundle]);
  const value = useMemo(() => ({ ...snapshot, apply, onExposureError }), [snapshot, apply, onExposureError]);
  return createElement(Context.Provider, { value }, children);
}

export interface UseFlagOptions {
  /** Expose in an effect after commit. Set false to expose only through expose(). Default: true. */
  expose?: boolean;
}

export interface FlagDetails<T> extends FlagBundle.Details<T> {
  /** Deduplicated per flag and snapshot. Rejects on delivery failure; a later call can retry. */
  expose: () => Promise<void>;
}

/** Evaluate a flag or dot path. Automatically expose after commit, never during render. */
export function useFlag<T extends FlagBundle.Value>(flagKey: string, defaultValue: T): T {
  return useFlagDetails(flagKey, defaultValue).value;
}

/** Evaluate locally, with optional manual exposure. Missing providers return defaults with an error. */
export function useFlagDetails<T extends FlagBundle.Value>(
  flagKey: string,
  defaultValue: T,
  options?: UseFlagOptions,
): FlagDetails<T> {
  const ctx = useContext(Context);
  const details = FlagBundle.evaluate(ctx?.bundle ?? missingBundle, flagKey, defaultValue);
  const { reason, shouldApply, variant, assignmentOrigin } = details;
  const [flagName] = flagKey.split('.', 1);
  const expose = useCallback((): Promise<void> => {
    if (!ctx || reason !== 'MATCH') return Promise.resolve();
    const existing = ctx.exposures.get(flagName);
    if (existing) return existing;
    const pending = Promise.resolve()
      .then(async () => {
        if (variant) publishFlagEvaluation(flagName, variant, assignmentOrigin ?? '');
        if (shouldApply) {
          const result = await ctx.apply(flagName);
          if (result && !result.ok) throw new Error(result.errorMessage ?? 'Flag exposure failed');
        }
      })
      .catch((cause: unknown) => {
        ctx.exposures.delete(flagName);
        throw cause instanceof Error ? cause : new Error(String(cause));
      });
    ctx.exposures.set(flagName, pending);
    return pending;
  }, [ctx, flagName, reason, shouldApply, variant, assignmentOrigin]);

  const autoExpose = options?.expose !== false;
  useEffect(() => {
    if (autoExpose) {
      void expose().catch(error => {
        if (ctx?.onExposureError) ctx.onExposureError(error);
        // eslint-disable-next-line no-console
        else console.warn('Confidence exposure failed', error);
      });
    }
  }, [autoExpose, expose, ctx]);

  return { ...details, expose };
}
