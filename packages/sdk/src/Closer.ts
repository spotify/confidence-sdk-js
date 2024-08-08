/**
 * Utility functions to manage Closer types
 * @public
 */
export namespace Closer {
  /** Combine multiple closers */
  export function combine(...closers: Closer[]): Closer {
    return () => {
      for (const closer of closers) {
        closer();
      }
    };
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
/**
 * Utility functions to manage Closer types
 * @public
 */
export type Closer = () => void;
