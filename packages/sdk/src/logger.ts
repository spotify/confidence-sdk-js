export namespace Logger {
  type Mutable<T> = { -readonly [P in keyof T]: T[P] };
  const NOOP_LOGGER = Object.freeze({});
  export const LEVELS = ['trace', 'debug', 'info', 'warn', 'error'] as const;
  export type Fn = (message: string, ...optionalParams: any[]) => void;
  export type Level = (typeof LEVELS)[number];

  export function noOp(): Logger {
    return NOOP_LOGGER;
  }

  export function withLevel(delegate: Logger, level: Level): Logger {
    const logger: Mutable<Logger> = {};
    for (let i = LEVELS.indexOf(level); i >= 0 && i < LEVELS.length; i++) {
      logger[LEVELS[i]] = delegate[LEVELS[i]]?.bind(delegate);
    }
    return Object.freeze(logger);
  }
}
export interface Logger {
  readonly trace?: Logger.Fn;
  readonly debug?: Logger.Fn;
  readonly info?: Logger.Fn;
  readonly warn?: Logger.Fn;
  readonly error?: Logger.Fn;
}
