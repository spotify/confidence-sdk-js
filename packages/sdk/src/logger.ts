/**
 * Receives diagnostics from the SDK. `console` satisfies it, and so does any
 * subset of it — a method left out means that level goes unreported.
 * @public
 */
export interface Logger {
  readonly trace?: Logger.Fn;
  readonly debug?: Logger.Fn;
  readonly info?: Logger.Fn;
  readonly warn?: Logger.Fn;
  readonly error?: Logger.Fn;
}

/**
 * Types belonging to {@link (Logger:interface)}
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace Logger {
  // Types only, so the public surface stays a plain interface: the helpers that
  // build the SDK's own loggers live in `LoggerUtil` below, unexported.
  /** One log method */
  export type Fn = (message: string, ...optionalParams: any[]) => void;
  /** How much a logger reports */
  export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

/** Composes the loggers the SDK defaults to. Not part of the public API. */
export namespace LoggerUtil {
  type Mutable<T> = { -readonly [P in keyof T]: T[P] };
  const NOOP_LOGGER = Object.freeze({});
  export const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;

  export function noOp(): Logger {
    return NOOP_LOGGER;
  }

  export function withLevel(delegate: Logger, level: Logger.Level): Logger {
    const logger: Mutable<Logger> = {};
    for (let i = LEVELS.indexOf(level); i >= 0 && i < LEVELS.length; i++) {
      logger[LEVELS[i]] = delegate[LEVELS[i]]?.bind(delegate);
    }
    return Object.freeze(logger);
  }
}
