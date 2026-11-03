import { Closer } from '../Closer';
import { Trackable } from '../Trackable';
import { listenOn, spyOn } from '../utils';

/**
 * Tracks page views
 * @public
 */
export function pageViews(): Trackable.Manager {
  return controller => {
    let referrer: string = document.referrer;
    let closed = false;

    controller.setContext({ page: currentPage() });

    const listeners = [
      // Routers call pushState/replaceState inside their own render phase (e.g. React effects),
      // so context updates and events triggered from there are deferred to a microtask.
      spyOn(history, 'pushState', () => {
        pageChanged({ type: 'pushstate' }, true);
      }),

      spyOn(history, 'replaceState', () => {
        pageChanged({ type: 'replacestate' }, true);
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

    const close = Closer.combine(...listeners);
    return () => {
      closed = true;
      close();
    };

    function currentPage() {
      return {
        path: location.pathname,
        search: location.search,
        referrer: referrer,
        title: document.title,
        url: location.href,
      };
    }

    function pageChanged({ type }: { type: string }, deferred = false) {
      const page = currentPage();
      referrer = location.href;

      const emit = () => {
        if (closed) return;
        controller.setContext({ page });
        controller.config.logger.debug?.('Confidence: page viewed', { type });
        controller.track('page-viewed');
      };

      if (deferred) {
        queueMicrotask(emit);
      } else {
        emit();
      }
    }
  };
}
