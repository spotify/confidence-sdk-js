import { Closer } from '../Closer';
import { Trackable } from '../Trackable';
import { listenOn, spyOn } from '../utils';

export function pageViews(): Trackable.Manager {
  return controller => {
    let referrer: string = document.referrer;

    controller.setContext({
      page: {
        path: location.pathname,
        search: location.search,
        referrer: referrer,
        title: document.title,
        url: location.href,
      },
    });

    return Closer.combine(
      spyOn(history, 'pushState', () => {
        pageChanged({ type: 'pushstate' });
      }),

      spyOn(history, 'replaceState', () => {
        pageChanged({ type: 'replacestate' });
      }),

      listenOn(window, 'popstate', pageChanged),

      listenOn(window, 'hashchange', pageChanged),

      listenOn(window, 'load', pageChanged),
    );

    function pageChanged({ type }: { type: string }) {
      controller.setContext({
        page: {
          path: location.pathname,
          search: location.search,
          referrer: referrer,
          title: document.title,
          url: location.href,
        },
      });
      controller.config.logger.debug?.('Confidence: page viewed', { type });
      controller.track('page-viewed');

      referrer = location.href;
    }
  };
}
