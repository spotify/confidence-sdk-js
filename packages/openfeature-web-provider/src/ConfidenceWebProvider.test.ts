import { EvaluationContext, ProviderEvents } from '@openfeature/web-sdk';
import { ConfidenceWebProvider } from './ConfidenceWebProvider';
import { Confidence } from '@spotify-confidence/sdk';

const setContextMock = jest.fn();
const resolveFlagsMock: jest.MockedFunction<Confidence['resolveFlags']> = jest.fn();
const applyMock = jest.fn();
const contextChangesMock = jest.fn();
const confidenceMock = {
  environment: 'client',
  resolveFlags: resolveFlagsMock,
  apply: applyMock,
  setContext: setContextMock,
  contextChanges: contextChangesMock,
} as unknown as Confidence;

const dummyContext: EvaluationContext = { targetingKey: 'test' };

describe('ConfidenceProvider', () => {
  let instanceUnderTest: ConfidenceWebProvider;

  beforeEach(() => {
    instanceUnderTest = new ConfidenceWebProvider(confidenceMock);
  });

  describe('initialize', () => {
    describe('with context', () => {
      it('should resolve', async () => {
        await instanceUnderTest.initialize({ targetingKey: 'test' });

        expect(resolveFlagsMock).toHaveBeenCalledOnce();
      });

      it('should setup a context change subscription', async () => {
        await instanceUnderTest.initialize({ targetingKey: 'test' });
        expect(contextChangesMock).toHaveBeenCalledOnce(expect.any(Function));
      });
    });

    describe('without context', () => {
      it('should resolve', async () => {
        await instanceUnderTest.initialize();
        expect(resolveFlagsMock).toHaveBeenCalledOnce();
      });

      it('should not set confidence context', async () => {
        await instanceUnderTest.initialize();
        expect(setContextMock).not.toHaveBeenCalled();
      });

      it('should setup a context change subscription', async () => {
        await instanceUnderTest.initialize({ targetingKey: 'test' });
        expect(contextChangesMock).toHaveBeenCalledOnce(expect.any(Function));
      });
    });

    describe('onContextChange', () => {
      describe('from OpenFeature', () => {
        it('should diff context and set only the changes to confidence', async () => {
          await instanceUnderTest.onContextChange(
            { targetingKey: 'test1', pantsPattern: 'Checkered' },
            { targetingKey: 'test2', pantsColor: 'Yellow' },
          );

          expect(setContextMock).toHaveBeenCalledTimes(1);
          expect(setContextMock).toHaveBeenCalledWith(
            expect.objectContaining({
              targeting_key: 'test2',
              pantsColor: 'Yellow',
              pantsPattern: undefined,
            }),
          );
        });

        it('should diff context but only shallow', async () => {
          await instanceUnderTest.onContextChange(
            { targetingKey: 'test1', pants: { color: 'Green', pattern: 'Checkered' } },
            { targetingKey: 'test1', pants: { color: 'Green' } },
          );

          expect(setContextMock).toHaveBeenCalledTimes(1);
          expect(setContextMock).toHaveBeenCalledWith({
            pants: { color: 'Green' },
          });
        });

        it('removal of targeting key should send undefined in setContext', async () => {
          await instanceUnderTest.onContextChange(
            { targetingKey: 'test1', pants: { color: 'Green' } },
            { pants: { color: 'Yellow' } },
          );

          expect(setContextMock).toHaveBeenCalledTimes(1);
          expect(setContextMock).toHaveBeenCalledWith({
            targeting_key: undefined,
            pants: { color: 'Yellow' },
          });
        });

        it('should not set confidence context with equal contexts', async () => {
          await instanceUnderTest.onContextChange(dummyContext, dummyContext);

          expect(setContextMock).not.toHaveBeenCalled();
        });
      });

      describe('from Confidence', () => {
        let contextChangeObserver: (keys: string[]) => void;

        beforeEach(() => {
          instanceUnderTest.initialize();
          contextChangeObserver = contextChangesMock.mock.lastCall[0];
          resolveFlagsMock.mockClear();
        });
        it('should resolve', () => {
          contextChangeObserver(['key']);
          expect(resolveFlagsMock).toHaveBeenCalledOnce();
        });
        it('should emit stale and then ready', async () => {
          const staleHandler = jest.fn();
          const readyHandler = jest.fn();
          instanceUnderTest.events.addHandler(ProviderEvents.Stale, staleHandler);
          instanceUnderTest.events.addHandler(ProviderEvents.Ready, readyHandler);

          contextChangeObserver(['key']);

          expect(staleHandler).toHaveBeenCalledTimes(1);
          expect(readyHandler).toHaveBeenCalledTimes(0);
          // await so that pending resolve is resolved
          await Promise.resolve();

          expect(readyHandler).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
