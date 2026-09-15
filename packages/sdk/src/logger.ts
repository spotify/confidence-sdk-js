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
  // Types only, so the public surface stays a plain interface.
  /** One log method */
  export type Fn = (message: string, ...optionalParams: any[]) => void;
  /** How much a logger reports */
  export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error';
}
