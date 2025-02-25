import { Confidence } from './core';
import './flagging';
import './flagging/caching';

it('should resolve flags', async () => {
  const confidence = Confidence.create({
    clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
    context: { targeting_key: 'test-a' },
  });

  const value = await confidence.getFlag('web-sdk-e2e-flag.int', 0);
  expect(value).toEqual(3);

  let isSync = false;
  confidence.getFlag('web-sdk-e2e-flag.int', 0).then(() => {
    expect(value).toEqual(3);
    isSync = true;
  });

  expect(isSync).toBe(true);
});
