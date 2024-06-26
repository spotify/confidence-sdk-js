export namespace Closer {
  export function combine(...closers: Closer[]): Closer {
    return () => {
      for (const closer of closers) {
        closer();
      }
    };
  }
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Closer = () => void;
