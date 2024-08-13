import { Context, Trackable } from '.';
import { visitorIdentity } from './trackers';

describe('visitorIdentity', () => {
  const mockController: Partial<Trackable.Controller> = {
    setContext: jest.fn(),
  };

  const mockedSetContextFn = mockController.setContext as jest.Mock<boolean, [context: Context]>;

  it('should generate a UUID, hash it with client secret, and set it as visitor_id', () => {
    // @ts-ignore
    visitorIdentity('test1')(mockController);
    // @ts-ignore
    visitorIdentity('test2')(mockController);
    // @ts-ignore
    visitorIdentity('test1')(mockController);

    const visitor1 = mockedSetContextFn.mock.calls[0][0].visitor_id;
    const visitor2 = mockedSetContextFn.mock.calls[1][0].visitor_id;
    const visitor3 = mockedSetContextFn.mock.calls[2][0].visitor_id;

    expect(visitor1).toEqual(visitor3);
    expect(visitor2).not.toEqual(visitor1);
  });
});
