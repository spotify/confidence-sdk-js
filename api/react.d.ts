import { ReactNode, ReactElement } from 'react';
import { FlagBundle } from '@spotify-confidence/sdk';

/** Exposure transport supplied by the application. Throw/reject or return ok:false on failure. */
type Apply = (flagName: string) => void | {
    ok: boolean;
    errorMessage?: string;
} | Promise<void | {
    ok: boolean;
    errorMessage?: string;
}>;
interface ConfidenceProviderProps {
    /** Immutable resolved snapshot. Replace it when the targeting context changes. */
    bundle: FlagBundle;
    /** Bound to this bundle's token; may call the thin client, an endpoint, or a server action. */
    apply: Apply;
    children?: ReactNode;
    /** Receives automatic exposure failures. Defaults to console.warn. Manual expose() rejects instead. */
    onExposureError?: (error: Error) => void;
}
/** Provides a resolved snapshot without fetching or exposing flags during render. */
declare function ConfidenceProvider({ bundle, apply, children, onExposureError, }: ConfidenceProviderProps): ReactElement;
interface UseFlagOptions {
    /** Expose in an effect after commit. Set false to expose only through expose(). Default: true. */
    expose?: boolean;
}
interface FlagDetails<T> extends FlagBundle.Details<T> {
    /** Deduplicated per flag and snapshot. Rejects on delivery failure; a later call can retry. */
    expose: () => Promise<void>;
}
/** Evaluate a flag or dot path. Automatically expose after commit, never during render. */
declare function useFlag<T extends FlagBundle.Value>(flagKey: string, defaultValue: T): T;
/** Evaluate locally, with optional manual exposure. Missing providers return defaults with an error. */
declare function useFlagDetails<T extends FlagBundle.Value>(flagKey: string, defaultValue: T, options?: UseFlagOptions): FlagDetails<T>;

export { type Apply, ConfidenceProvider, type ConfidenceProviderProps, type FlagDetails, type UseFlagOptions, useFlag, useFlagDetails };
