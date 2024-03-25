import { EventSenderEngine } from './EventSenderEngine';

describe('EventSenderEngine E2E Tests', () => {
  const engine = new EventSenderEngine({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    maxBatchSize: 100,
    flushTimeoutMilliseconds: 0,
    fetchImplementation: fetch.bind(globalThis),
    region: 'eu',
  });

  describe('flush', () => {
    it('should return true if all events succeed', async () => {
      engine.send({}, 'js-sdk-e2e-test', { pants: 'blue' });
      await expect(engine.flush()).resolves.toBe(true);
    });
    it('should return false if any event fails', async () => {
      engine.send({}, 'js-sdk-e2e-test', { pants: 'red' });
      engine.send({}, 'js-sdk-e2e-test', { pants: 3 });
      await expect(engine.flush()).resolves.toBe(false);
    });
  });
});
