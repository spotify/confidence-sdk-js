import { ConfidenceClient } from './client';
import { ApplyManager } from './ApplyManager';

const resolveMock = jest.fn();
const mockClient = {
  resolve: jest.fn(),
  apply: resolveMock,
} as jest.MockedObject<ConfidenceClient>;

describe('ApplyManager', () => {
  const fakeDate = new Date();
  let instanceUnderTest: ApplyManager;

  beforeEach(() => {
    instanceUnderTest = new ApplyManager({
      timeout: 100,
      client: mockClient,
    });
    resolveMock.mockResolvedValue({});
    jest.useFakeTimers();
    jest.setSystemTime(fakeDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send apply with the accessed flag after timeout', async () => {
    instanceUnderTest.apply('some-token', 'apply-test');

    jest.advanceTimersByTime(99);
    expect(resolveMock).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1);
    expect(resolveMock).toHaveBeenCalledTimes(1);

    expect(resolveMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test',
          applyTime: fakeDate.toISOString(),
        },
      ],
      'some-token',
    );
  });

  it('should send apply with multiple accessed flags after timeout with the same token', async () => {
    instanceUnderTest.apply('some-token', 'apply-test');
    const firstApplyTime = new Date().toISOString();

    jest.advanceTimersByTime(50);

    instanceUnderTest.apply('some-token', 'apply-test1');
    const secondApplyTime = new Date().toISOString();

    expect(resolveMock).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(100);
    expect(resolveMock).toHaveBeenCalledTimes(1);

    expect(resolveMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test',
          applyTime: firstApplyTime,
        },
        {
          flag: 'flags/apply-test1',
          applyTime: secondApplyTime,
        },
      ],
      'some-token',
    );
  });

  it('should send multiple apply events with the same flag under different resolve tokens', async () => {
    instanceUnderTest.apply('some-token1', 'apply-test1');
    instanceUnderTest.apply('some-token2', 'apply-test2');

    jest.advanceTimersByTime(100);

    expect(resolveMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test1',
          applyTime: fakeDate.toISOString(),
        },
      ],
      'some-token1',
    );
    expect(resolveMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test2',
          applyTime: fakeDate.toISOString(),
        },
      ],
      'some-token2',
    );
  });
});
