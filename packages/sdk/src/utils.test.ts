import { spyOn } from './utils';

describe('spyOn', () => {
  function setup() {
    const original = jest.fn(() => 'result');
    const target = { fn: original };
    const first = jest.fn();
    const second = jest.fn();
    const closeFirst = spyOn(target, 'fn', first);
    const closeSecond = spyOn(target, 'fn', second);
    return { target, original, first, second, closeFirst, closeSecond };
  }

  it('calls every spy and the original function', () => {
    const { target, original, first, second } = setup();
    expect(target.fn()).toBe('result');
    expect(original).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps later spies when an earlier one is closed first', () => {
    const { target, original, first, second, closeFirst, closeSecond } = setup();
    closeFirst();
    target.fn();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    closeSecond();
    target.fn();
    expect(second).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledTimes(2);
  });

  it('restores the original function when closed in reverse order', () => {
    const { target, original, closeFirst, closeSecond } = setup();
    closeSecond();
    closeFirst();
    expect(target.fn).toBe(original);
  });
});
