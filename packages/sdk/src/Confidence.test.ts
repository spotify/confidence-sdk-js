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
  describe('setContext', () => {
    it('defensively copies values', () => {
      const confidence = new Confidence({} as any);
      const clothes = { pants: 'yellow' };
      confidence.setContext({ clothes });
      clothes.pants = 'blue';
      expect(confidence.getContext()).toEqual({ clothes: { pants: 'yellow' } });
    });

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

  describe('contextChanges', () => {
    it('should emit one context change for each setContext call', () => {
      const confidence = new Confidence({} as any);

      const observerMock = jest.fn();

      const close = confidence.contextChanges(observerMock);

      confidence.setContext({ pantsOn: true, pantsColor: 'yellow' });
      expect(observerMock).toHaveBeenCalledWith(['pantsOn', 'pantsColor']);

      confidence.setContext({ pantsOn: false, pantsColor: 'yellow', pantsPattern: 'striped' });
      expect(observerMock).toHaveBeenCalledWith(['pantsOn', 'pantsPattern']);

      close();
    });
    it('should emit context change for setContext calls in parent', () => {
      const parent = new Confidence({} as any);
      const child = parent.withContext({ pantsColor: 'blue' });

      const observerMock = jest.fn();

      const close = child.contextChanges(observerMock);

      parent.setContext({ pantsOn: true, pantsColor: 'yellow' });

      // child has pantsColor that shadows the update from parent
      expect(observerMock).toHaveBeenCalledWith(['pantsOn']);

      child.setContext({ pantsPattern: 'striped' });

      expect(observerMock).toHaveBeenCalledWith(['pantsPattern']);

      close();
    });

    it('should not emit context change from parent if all keys are overridden', () => {
      const parent = new Confidence({} as any);
      parent.setContext({ pants: 'red' });
      const child = parent.withContext({ pants: 'green' });

      const observerMock = jest.fn();

      const close = child.contextChanges(observerMock);

      parent.setContext({ pants: 'blue' });

      expect(observerMock).not.toHaveBeenCalled();

      close();
    });

    it('should only emit context change if the value actually changed', () => {
      const parent = new Confidence({} as any);
      parent.setContext({ pants: 'red' });
      const child = parent.withContext({});

      const observerMock = jest.fn();

      const close = child.contextChanges(observerMock);

      child.setContext({ pants: 'red' });

      expect(observerMock).not.toHaveBeenCalled();

      close();
    });
  });
});
