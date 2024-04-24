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
      const clothes = { pants: 'yellow' };
      confidence.setContext({ clothes });
      clothes.pants = 'blue';
      expect(confidence.getContext()).toEqual({ clothes: { pants: 'yellow' } });
    });
  });
  describe('setContext', () => {
    it('sets context', () => {
      const confidence = new Confidence({} as any);
      const newContext = {
        pants: 'yellow',
      };
      confidence.setContext(newContext);
      expect(confidence.getContext()).toEqual(newContext);
    });
  });
  describe('withContext', () => {
    it('creates a child context', () => {
      const parent = new Confidence({} as any);
      const additionalContext = {
        clothes: 'pants',
      };
      const child = parent.withContext(additionalContext);
      expect(child.getContext()).toEqual(additionalContext);
    });
    it('merge contexts', () => {
      const parent = new Confidence({} as any);
      parent.setContext({
        clothes: 'pants',
      });
      const child = parent.withContext({
        pants: 'blue',
      });
      expect(child.getContext()).toEqual({
        clothes: 'pants',
        pants: 'blue',
      });
    });
    it('remove entry from context', () => {
      const parent = new Confidence({} as any);
      parent.setContext({
        clothes: 'pants',
      });
      const child = parent.withContext({});
      child.setContext({ clothes: undefined });
      expect(child.getContext()).toEqual({});
      expect(parent.getContext()).toEqual({
        clothes: 'pants',
      });
      expect(Object.keys(child.getContext())).toEqual([]);
      child.clearContext();
      expect(child.getContext()).toEqual({
        clothes: 'pants',
      });
    });
  });
  describe('create', () => {
    it('creates a new confidence object', () => {
      const confidence = Confidence.create({
        clientSecret: 'secret',
        region: 'us',
        baseUrl: 'https://www.spotify.com',
        environment: 'client',
        fetchImplementation: {} as any,
        timeout: 10,
      });
      expect(confidence.getContext()).toEqual({});
    });
  });

  describe('track', () => {
    it('sets up a subscription that can be closed once', () => {
      const confidence = new Confidence({} as any);
      const mockManager = jest.fn();
      const mockCloser = jest.fn();
      mockManager.mockReturnValue(mockCloser);

      const closer = confidence.track(mockManager);
      expect(mockManager).toHaveBeenCalled();
      expect(mockCloser).not.toHaveBeenCalled();
      // close
      closer();
      closer();

      expect(mockCloser).toHaveBeenCalledOnce();
    });
  });
});
