/**
 * @jest-environment jsdom
 */
import { Trackable } from '../Trackable';
import { pageViews } from './pageViews';

function createController() {
  return {
    setContext: jest.fn(),
    track: jest.fn(),
    config: { logger: {} },
  } as unknown as jest.Mocked<Trackable.Controller>;
}

const flushMicrotasks = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('pageViews', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/start');
  });

  it('tracks the initial page view synchronously', () => {
    const controller = createController();
    const close = pageViews()(controller) as () => void;

    expect(controller.setContext).toHaveBeenLastCalledWith({
      page: expect.objectContaining({ path: '/start' }),
    });
    expect(controller.track).toHaveBeenCalledWith('page-viewed');

    close();
  });

  it('defers pushState and replaceState page views to a microtask', async () => {
    const controller = createController();
    const close = pageViews()(controller) as () => void;
    controller.setContext.mockClear();
    controller.track.mockClear();

    history.pushState(null, '', '/next');

    expect(controller.setContext).not.toHaveBeenCalled();
    expect(controller.track).not.toHaveBeenCalled();

    await flushMicrotasks();

    expect(controller.setContext).toHaveBeenCalledWith({
      page: expect.objectContaining({
        path: '/next',
        url: 'http://localhost/next',
        referrer: 'http://localhost/start',
      }),
    });
    expect(controller.track).toHaveBeenCalledWith('page-viewed');

    close();
  });

  it('keeps the page data of each navigation when several happen in one task', async () => {
    const controller = createController();
    const close = pageViews()(controller) as () => void;
    controller.setContext.mockClear();

    history.pushState(null, '', '/a');
    history.pushState(null, '', '/b');
    await flushMicrotasks();

    expect(controller.setContext.mock.calls.map(([context]) => (context as any).page)).toEqual([
      expect.objectContaining({ path: '/a', referrer: 'http://localhost/start' }),
      expect.objectContaining({ path: '/b', referrer: 'http://localhost/a' }),
    ]);

    close();
  });

  it('skips deferred page views once closed', async () => {
    const controller = createController();
    const close = pageViews()(controller) as () => void;
    controller.setContext.mockClear();
    controller.track.mockClear();

    history.pushState(null, '', '/closing');
    close();
    await flushMicrotasks();

    expect(controller.setContext).not.toHaveBeenCalled();
    expect(controller.track).not.toHaveBeenCalled();
  });

  it('tracks popstate synchronously', () => {
    const controller = createController();
    const close = pageViews()(controller) as () => void;
    controller.track.mockClear();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(controller.track).toHaveBeenCalledWith('page-viewed');

    close();
  });
});
