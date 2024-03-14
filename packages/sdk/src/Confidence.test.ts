import { Confidence } from './Confidence';

describe('Confidence', () => {
  describe('context', () => {
    it('returns immutable values', () => {
      const confidence = new Confidence({} as any);
      const context = confidence.getContext();
      expect(() => {
        // @ts-expect-error
        context.pants = 'yellow';
      }).toThrow('Cannot add property pants, object is not extensible');
    });
  });
  describe('put', () => {
    it('defensively copies values', () => {
      const confidence = new Confidence({} as any);
      const value = { pants: 'yellow' };
      confidence.updateContext('clothes', value);
      value.pants = 'blue';
      expect(confidence.getContext()).toEqual({ clothes: { pants: 'yellow' } });
    });
  });
});
