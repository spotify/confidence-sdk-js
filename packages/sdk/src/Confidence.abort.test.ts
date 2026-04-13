import { Confidence } from './Confidence';
import { EventSenderEngine } from './EventSenderEngine';
import { FlagResolution } from './FlagResolution';
import { FlagResolverClient, PendingResolution } from './FlagResolverClient';
import { State } from './flags';

const flagResolverClientMock: jest.Mocked<FlagResolverClient> = {
  resolve: jest.fn(),
};

const eventSenderEngineMock: jest.Mocked<EventSenderEngine> = {} as any;

function createAbortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

describe('Confidence - AbortError state machine bugs', () => {
  let confidence: Confidence;

  beforeEach(() => {
    confidence = new Confidence({
      clientSecret: 'secret',
      timeout: 10,
      environment: 'client',
      logger: {},
      eventSenderEngine: eventSenderEngineMock,
      flagResolverClient: flagResolverClientMock,
      cacheProvider: () => {
        throw new Error('Not implemented');
      },
      staleFlagTraceConsumer: jest.fn(),
      emitEvaluationTrace: jest.fn(),
    });
  });

  afterEach(() => {
    flagResolverClientMock.resolve.mockReset();
  });

  describe('happy path: context change during resolve', () => {
    it('should reach READY when second resolve succeeds after first is aborted', async () => {
      const resolvers: Array<{
        resolve: (v: FlagResolution) => void;
        reject: (r: any) => void;
      }> = [];

      flagResolverClientMock.resolve.mockImplementation(context => {
        // Pass actual context so resolveFlags() context-equality check works
        return PendingResolution.create(context, signal => {
          return new Promise<FlagResolution>((resolve, reject) => {
            resolvers.push({ resolve, reject });
            signal.addEventListener('abort', () => reject(createAbortError()));
          });
        });
      });

      const states: State[] = [];
      const close = confidence.subscribe(state => states.push(state));

      expect(states).toEqual(['NOT_READY']);
      expect(resolvers).toHaveLength(1);

      // Context change aborts first resolve, starts second
      confidence.setContext({ user: 'a' });
      expect(resolvers).toHaveLength(2);

      // Second resolve succeeds
      resolvers[1].resolve({
        state: 'READY',
        context: { user: 'a' },
        evaluate: jest.fn(),
      });

      await new Promise(r => setTimeout(r, 50));
      expect(states).toContain('READY');
      close();
    });

    it('should reach READY after rapid context changes when last resolve succeeds', async () => {
      const resolvers: Array<{
        resolve: (v: FlagResolution) => void;
        reject: (r: any) => void;
        context: any;
      }> = [];

      flagResolverClientMock.resolve.mockImplementation(context => {
        return PendingResolution.create(context, signal => {
          return new Promise<FlagResolution>((resolve, reject) => {
            resolvers.push({ resolve, reject, context });
            signal.addEventListener('abort', () => reject(createAbortError()));
          });
        });
      });

      const states: State[] = [];
      const close = confidence.subscribe(state => states.push(state));

      // Rapid context changes - each aborts the previous resolve
      confidence.setContext({ user: '1' });
      confidence.setContext({ user: '2' });

      // Wait for aborted resolve chains to settle
      await new Promise(r => setTimeout(r, 50));

      // Resolve the last pending resolve
      const last = resolvers[resolvers.length - 1];
      last.resolve({
        state: 'READY',
        context: last.context,
        evaluate: jest.fn(),
      });

      await new Promise(r => setTimeout(r, 50));
      expect(states).toContain('READY');
      close();
    });
  });

  describe('AbortError should transition to ERROR', () => {
    it('should transition to ERROR when resolve rejects with AbortError', async () => {
      // When a resolve rejects with AbortError, the catch block in
      // Confidence.ts:262-267 should set currentFlags to a failed resolution
      // so that flagState transitions to ERROR and subscribers are notified.
      flagResolverClientMock.resolve.mockImplementation(context => {
        return PendingResolution.create(context, () => {
          return Promise.reject(createAbortError());
        });
      });

      const states: State[] = [];
      const close = confidence.subscribe(state => states.push(state));

      // Wait for promise chains to settle
      await new Promise(r => setTimeout(r, 50));

      // Expected: state should transition from NOT_READY to ERROR
      expect(states).toContain('ERROR');
      close();
    });

    it('should transition to ERROR after rapid context changes when all resolves fail', async () => {
      // Every resolve rejects with AbortError immediately.
      // After all promise chains settle, state should reach ERROR.
      flagResolverClientMock.resolve.mockImplementation(context => {
        return PendingResolution.create(context, () => {
          return Promise.reject(createAbortError());
        });
      });

      const states: State[] = [];
      const close = confidence.subscribe(state => states.push(state));

      // Each setContext triggers a new resolve (also immediately fails)
      confidence.setContext({ user: '1' });
      confidence.setContext({ user: '2' });

      // Wait for all resolve chains to settle
      await new Promise(r => setTimeout(r, 200));

      // Expected: state should eventually reach ERROR
      expect(states).toContain('ERROR');
      close();
    });

    it('should notify subscriber of ERROR state after AbortError', async () => {
      // After a resolve fails with AbortError, the subscriber should
      // be notified of the ERROR state. changeObserver should see the
      // transition from NOT_READY to ERROR (different values → not deduped).
      flagResolverClientMock.resolve.mockImplementation(context => {
        return PendingResolution.create(context, () => {
          return Promise.reject(createAbortError());
        });
      });

      const observer = jest.fn();
      const close = confidence.subscribe(observer);

      await new Promise(r => setTimeout(r, 50));

      // Expected: observer called twice — first NOT_READY, then ERROR
      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer).toHaveBeenNthCalledWith(1, 'NOT_READY');
      expect(observer).toHaveBeenNthCalledWith(2, 'ERROR');
      close();
    });
  });

  describe('cleanup', () => {
    it('unsubscribe during initial resolve fires abort signal', () => {
      let abortFired = false;

      flagResolverClientMock.resolve.mockImplementation(context => {
        return PendingResolution.create(context, signal => {
          signal.addEventListener('abort', () => {
            abortFired = true;
          });
          return new Promise<FlagResolution>(() => {}); // never resolves
        });
      });

      const close = confidence.subscribe(() => {});

      expect(abortFired).toBe(false);
      close(); // unsubscribe → cleanup runs → abort pending flags
      expect(abortFired).toBe(true);
    });
  });
});
