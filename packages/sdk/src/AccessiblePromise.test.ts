import { AccessiblePromise } from './AccessiblePromise';

describe('AccessiblePromise', () => {
  describe('resolved', () => {
    const resolved = AccessiblePromise.resolve(237);

    it('has state resolved', () => {
      expect(resolved.state).toBe('RESOLVED');
    });

    it('can be awaited', async () => {
      expect(await resolved).toBe(237);
    });

    it('synchronously returns a new AccessiblePromise on then', () => {
      const other = resolved.then(value => value + 1);
      expect(other.state).toBe('RESOLVED');
      expect(other.or(0)).toBe(238);
    });

    it('rejects if then handler throws', () => {
      const other = resolved.then<number>(() => {
        throw new Error('error');
      });
      expect(other.state).toBe('REJECTED');
      expect(() => other.or(0)).toThrow('error');
    });
  });

  describe('pending', () => {
    let pending: AccessiblePromise<number>;

    beforeEach(() => {
      pending = AccessiblePromise.resolve(tick().then(() => 237));
    });
    it('has state pending', () => {
      expect(pending.state).toBe('PENDING');
    });

    it('can be awaited', async () => {
      expect(await pending).toBe(237);
      expect(pending.state).toBe('RESOLVED');
    });

    it('returns the alternative value', () => {
      expect(pending.or(0)).toBe(0);
    });
  });
});

function tick(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}
