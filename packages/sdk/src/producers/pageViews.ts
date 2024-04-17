import { createProducer, kContext } from '../events';
import { Event as ConfidenceEvent } from '../events';

export type PageViewsProduceOptions = {
  // Add options here
  shouldEmitEvent?: boolean;
};

export function pageViews({ shouldEmitEvent = true }: PageViewsProduceOptions = {}) {
  return createProducer(emit => {
    let previousPath: string;

    spyOn(history, 'pushState', () => {
      pageChanged({ type: 'pushstate' });
    });
    spyOn(history, 'replaceState', () => {
      pageChanged({ type: 'replacestate' });
    });

    // listen to history push states
    listenOn(window, 'popstate', pageChanged);

    // treat hash changes as page views
    listenOn(window, 'hashchange', pageChanged);

    pageChanged({ type: 'initial' });

    function pageChanged({ type }: { type: string }) {
      // if (location.pathname === previousPath) return;
      const action: ConfidenceEvent = {
        [kContext]: {
          page: {
            path: location.pathname,
            search: location.search,
            referrer: document.referrer,
            title: document.title,
            url: location.href,
          },
        },
      };
      if (shouldEmitEvent) {
        action['page-view'] = {
          previousPath,
          trigger: type,
        };
      }
      emit(action);
      previousPath = location.pathname;
    }
  });
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
