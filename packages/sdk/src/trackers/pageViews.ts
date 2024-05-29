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

    const listeners = [
      spyOn(history, 'pushState', () => {
        pageChanged({ type: 'pushstate' });
      }),

      spyOn(history, 'replaceState', () => {
        pageChanged({ type: 'replacestate' });
      }),

      listenOn(window, 'popstate', pageChanged),

      listenOn(window, 'hashchange', pageChanged),
    ];

    // if document is already loaded, call pageChanged otherwise listen for load event
    if (document.readyState === 'complete') {
      pageChanged({ type: 'load' });
    } else {
      listeners.push(listenOn(window, 'load', pageChanged));
    }

    return Closer.combine(...listeners);

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
