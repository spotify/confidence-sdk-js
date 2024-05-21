import { Closer } from './Closer';
import { Confidence } from './Confidence';
import { EventSenderEngine } from './EventSenderEngine';
import { FlagResolution, FlagResolverClient } from './FlagResolverClient';
import { FlagEvaluation, FlagState, FlagStateObserver } from './flags';

const flagResolverClientMock: jest.Mocked<FlagResolverClient> = {
  resolve: jest.fn(),
} as any; // TODO fix any by using an interface

const eventSenderEngineMock: jest.Mocked<EventSenderEngine> = {} as any; // TODO fix any by using an interface
const abortMock = jest.fn();

describe('Confidence', () => {
  let confidence: Confidence;

  const matchedEvaluation: FlagEvaluation<any> = {
    reason: 'MATCH',
    value: 'mockValue',
    variant: 'mockVariant',
  };

  beforeEach(() => {
    confidence = new Confidence({
      timeout: 10,
      environment: 'client',
      logger: {},
      eventSenderEngine: eventSenderEngineMock,
      flagResolverClient: flagResolverClientMock,
    });
    flagResolverClientMock.resolve.mockImplementation((context, _flags) => {
      const flagResolution = new Promise<FlagResolution>((resolve, _reject) => {
        setTimeout(() => {
          resolve({
            context: context,
            evaluate: jest.fn().mockImplementation(() => matchedEvaluation),
          });
        }, 0);
      });

      return Object.assign(Promise.resolve(flagResolution), {
        context: {},
        abort: abortMock,
      });
    });
  });

  describe('context', () => {
    it('returns immutable values', () => {
      const context = confidence.getContext();
      expect(() => {
        // @ts-expect-error
        context.pants = 'yellow';
      }).toThrow('Cannot add property pants, object is not extensible');
    });
  });
  describe('setContext', () => {
    it('defensively copies values', () => {
      const clothes = { pants: 'yellow' };
      confidence.setContext({ clothes });
      clothes.pants = 'blue';
      expect(confidence.getContext()).toEqual({ clothes: { pants: 'yellow' } });
    });

    it('sets context', () => {
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
      const c = Confidence.create({
        clientSecret: 'secret',
        region: 'us',
        environment: 'client',
        fetchImplementation: {} as any,
        timeout: 10,
      });
      expect(c.getContext()).toEqual({});
    });
  });

  describe('track', () => {
    it('sets up a subscription that can be closed once', () => {
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
      const observerMock = jest.fn();

      const close = confidence.contextChanges(observerMock);

      confidence.setContext({ pantsOn: true, pantsColor: 'yellow' });
      expect(observerMock).toHaveBeenCalledWith(['pantsOn', 'pantsColor']);

      confidence.setContext({ pantsOn: false, pantsColor: 'yellow', pantsPattern: 'striped' });
      expect(observerMock).toHaveBeenCalledWith(['pantsOn', 'pantsPattern']);

      close();
    });
    it('should emit context change for setContext calls in parent', () => {
      const parent = confidence;
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
      const parent = confidence;
      parent.setContext({ pants: 'red' });
      const child = parent.withContext({ pants: 'green' });

      const observerMock = jest.fn();

      const close = child.contextChanges(observerMock);

      parent.setContext({ pants: 'blue' });

      expect(observerMock).not.toHaveBeenCalled();

      close();
    });

    it('should only emit context change if the value actually changed', () => {
      const parent = confidence;
      parent.setContext({ pants: { color: 'red' } });
      const child = parent.withContext({});

      const observerMock = jest.fn();

      const close = child.contextChanges(observerMock);

      child.setContext({ pants: { color: 'red' } });

      expect(observerMock).not.toHaveBeenCalled();

      close();
    });
  });

  describe('subscribe', () => {
    const observer: jest.MockedFunction<FlagStateObserver> = jest.fn();
    let close: Closer;
    beforeEach(() => {
      close = confidence.subscribe(observer);
    });

    afterEach(() => {
      close();
    });

    const expectState = (expectedState: FlagState) =>
      new Promise<void>((resolve, reject) => {
        observer.mockImplementationOnce(state => {
          if (state === expectedState) {
            resolve();
          } else {
            reject(new Error(`Expected state ${expectState} but received ${state}`));
          }
        });
      });

    it('should start in state NOT_READY', () => {
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith('NOT_READY');
    });

    it('should eventually become ready', async () => {
      await expectState('READY');
    });

    describe('NOT_READY state', () => {
      beforeEach(() => {
        expect(observer).toHaveBeenLastCalledWith('NOT_READY');
        observer.mockClear();
      });

      it('should remain NOT_READY when context is changed', () => {
        confidence.setContext({ pants: 'green' });
        expect(observer).not.toHaveBeenCalled();
      });

      it('should become READY', () => {
        return expectState('READY');
      });
    });

    describe('READY state', () => {
      beforeEach(async () => {
        await expectState('READY');
        observer.mockClear();
      });

      it('should immediately be STALE after context change', () => {
        confidence.setContext({ pants: 'orange' });
        expect(observer).toHaveBeenCalledWith('STALE');
      });

      it('should remain in READY if closed and reopened', () => {
        close();
        close = confidence.subscribe(observer);
        expect(observer).toHaveBeenCalledWith('READY');
      });
    });
    describe('STALE state', () => {
      beforeEach(async () => {
        await expectState('READY');
        confidence.setContext({ pants: 'blue' });
        expect(observer).toHaveBeenLastCalledWith('STALE');
        observer.mockClear();
      });

      it('should remain STALE after context change', () => {
        confidence.setContext({ pants: 'orange' });
        expect(observer).not.toHaveBeenCalled();
      });

      it('should remain STALE if closed and reopened', () => {
        close();
        close = confidence.subscribe(observer);
        expect(observer).toHaveBeenCalledTimes(1);
        expect(observer).toHaveBeenCalledWith('STALE');
      });
    });
  });

  describe('evaluateFlag', () => {
    it('should return an evaluation for a flag when awaiting', async () => {
      const result = await confidence.evaluateFlag('flag1', 'default');
      expect(flagResolverClientMock.resolve).toHaveBeenCalledWith({}, []);
      expect(result).toEqual({
        reason: 'MATCH',
        value: 'mockValue',
        variant: 'mockVariant',
      });
      expect(flagResolverClientMock.resolve).toHaveBeenCalledTimes(1);
    });

    it('should return provider not ready with defaults if no currentFlags and not awaiting', async () => {
      const result = confidence.evaluateFlag('flag1', 'default');
      expect(result).toEqual({
        reason: 'ERROR',
        value: 'default',
        errorCode: 'PROVIDER_NOT_READY',
        errorMessage: 'Provider is not yet ready',
        then: expect.any(Function),
      });
      await Promise.resolve();
      expect(flagResolverClientMock.resolve).toHaveBeenCalledWith({}, []);
    });

    it('error evaluation should be awaitable', async () => {
      const result = confidence.evaluateFlag('flag1', 'default');
      expect(result).toEqual({
        reason: 'ERROR',
        value: 'default',
        errorCode: 'PROVIDER_NOT_READY',
        errorMessage: 'Provider is not yet ready',
        then: expect.any(Function),
      });
      const awaited = await result;
      expect(flagResolverClientMock.resolve).toHaveBeenCalledWith({}, []);
      expect(awaited).toEqual({
        reason: 'MATCH',
        value: 'mockValue',
        variant: 'mockVariant',
      });
    });

    it('should write to currentFlags when awaiting', async () => {
      await confidence.evaluateFlag('flag1', 'default');
      expect(flagResolverClientMock.resolve).toHaveBeenCalledWith({}, []);
      confidence.evaluateFlag('flag1', 'default');
      // should not call resolve again
      expect(flagResolverClientMock.resolve).toHaveBeenCalledTimes(1);
    });

    it('should use cache when evaluating', async () => {
      await confidence.evaluateFlag('flag1', 'default');
      expect(flagResolverClientMock.resolve).toHaveBeenCalledWith({}, []);
      const result = confidence.evaluateFlag('flag1', 'default');
      // should not call resolve again
      expect(result).toEqual({
        reason: 'MATCH',
        value: 'mockValue',
        variant: 'mockVariant',
      });
      expect(flagResolverClientMock.resolve).toHaveBeenCalledTimes(1);
    });
  });
});
