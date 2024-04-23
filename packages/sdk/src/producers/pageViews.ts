import { Closer } from '../Closer';
import { Trackable } from '../Trackable';

export type PageViewsOptions = {
  // Add options here
  shouldEmitEvent?: boolean;
};

export function pageViews({ shouldEmitEvent = true }: PageViewsOptions = {}): Trackable.Manager {
  return confidence => {
    let previousPath: string;

    confidence.setContext({
      page: {
        path: location.pathname,
        search: location.search,
        referrer: document.referrer,
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

      // listen to history push state
      listenOn(window, 'popstate', pageChanged),

      // treat hash changes as page views
      listenOn(window, 'hashchange', pageChanged),

      listenOn(window, 'load', pageChanged),
    );

    function pageChanged({ type }: { type: string }) {
      confidence.setContext({
        page: {
          path: location.pathname,
          search: location.search,
          referrer: document.referrer,
          title: document.title,
          url: location.href,
        },
      });
      if (shouldEmitEvent) {
        confidence.sendEvent('page-viewed', {
          previousPath,
          trigger: type,
        });
      }
      previousPath = location.pathname;
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
