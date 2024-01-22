import { ConfidenceClient } from './client';
import { ApplyManager } from './ApplyManager';

const applyMock = jest.fn();
const mockClient = {
  resolve: jest.fn(),
  apply: applyMock,
} as jest.MockedObject<ConfidenceClient>;

describe('ApplyManager', () => {
  const fakeDate = new Date();
  let instanceUnderTest: ApplyManager;

  beforeEach(() => {
    instanceUnderTest = new ApplyManager({
      timeout: 100,
      maxBufferSize: 3,
      client: mockClient,
    });
    applyMock.mockResolvedValue({});
    jest.useFakeTimers();
    jest.setSystemTime(fakeDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should send apply with the accessed flag after timeout', async () => {
    instanceUnderTest.apply('some-token', 'apply-test');

    jest.advanceTimersByTime(99);
    expect(applyMock).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1);
    expect(applyMock).toHaveBeenCalledTimes(1);

    expect(applyMock).toHaveBeenCalledWith(
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

    expect(applyMock).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(100);
    expect(applyMock).toHaveBeenCalledTimes(1);

    expect(applyMock).toHaveBeenCalledWith(
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

    expect(applyMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test1',
          applyTime: fakeDate.toISOString(),
        },
      ],
      'some-token1',
    );
    expect(applyMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test2',
          applyTime: fakeDate.toISOString(),
        },
      ],
      'some-token2',
    );
  });

  it('should send apply event when the max buffer size is met, and flush the apply events', async () => {
    const applyTime = new Date().toISOString();

    instanceUnderTest.apply('some-token', 'apply-test');
    instanceUnderTest.apply('some-token', 'apply-test1');
    instanceUnderTest.apply('some-token', 'apply-test2');

    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(applyMock).toHaveBeenCalledWith(
      [
        {
          flag: 'flags/apply-test',
          applyTime: applyTime,
        },
        {
          flag: 'flags/apply-test1',
          applyTime: applyTime,
        },
        {
          flag: 'flags/apply-test2',
          applyTime: applyTime,
        },
      ],
      'some-token',
    );
  });

  it('should not resend events if the buffer overflows before the previous apply has completed', () => {
    for (let i = 0; i < 10; i++) instanceUnderTest.apply('some-token', `apply-test${i}`);

    expect(applyMock).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(100);
    expect(applyMock).toHaveBeenCalledTimes(4);
  });

  it('should not attempt to send empty apply events', () => {
    instanceUnderTest.apply('some-token', `apply-test`);
    instanceUnderTest.flush();
    expect(applyMock).toHaveBeenCalledTimes(1);

    instanceUnderTest.flush(); // nothing left to send
    expect(applyMock).toHaveBeenCalledTimes(1);
  });
});
