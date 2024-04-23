import { Closer } from '../Closer';
import { Trackable } from '../Trackable';

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
      controller.config.logger.debug?.('page viewed', { type });
      controller.sendEvent('page-viewed');

      referrer = location.href;
    }
  };
}

type CleanupFn = () => void;
type PickFn<T> = {
  [K in keyof Required<T> as T[K] extends (...args: any) => any ? K : never]: T[K] extends (...args: any) => any
    ? T[K]
    : never;
};

function spyOn<T extends {}, N extends keyof PickFn<T>>(
  target: T,
  fnName: N,
  callback: (...args: Parameters<PickFn<T>[N]>) => void,
): CleanupFn {
  const t = target as any;
  const originalFn = t[fnName];
  t[fnName] = function (...args: any): any {
    try {
      return originalFn.call(this, ...args);
    } finally {
      callback(...args);
    }
  };
  return () => {
    t[fnName] = originalFn;
  };
}

function listenOn(target: EventTarget, type: string, listener: (e: Event) => void): CleanupFn {
  target.addEventListener(type, listener);
  return () => {
    target.removeEventListener(type, listener);
  };
}
