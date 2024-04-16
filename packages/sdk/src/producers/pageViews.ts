import { createProducer } from '../events';
import { Event as Action } from '../events';

export type PageViewsProduceOptions = {
    // Add options here
    shouldEmitEvent?: boolean;
    shouldUseHashChange?: boolean;
};

export function pageViews({shouldEmitEvent = true, shouldUseHashChange = false}: PageViewsProduceOptions = {}) {
  return createProducer(emit => {
    let previousPath: string;

    pageChanged();
    // listen to history push states
    window.addEventListener('popstate', pageChanged);
    if(shouldUseHashChange) {
        // treat hash changes as page views
        window.addEventListener('hashchange', pageChanged);
    }
    
    function pageChanged(event?: Event) {
        // if (location.pathname === previousPath) return;
        const action: Action = {
            context: {
                page: {
                    path: location.pathname,
                    search: location.search,
                    referrer: document.referrer,
                    title: document.title,
                    url: location.href,
                }
            }
        };
        if (shouldEmitEvent) {
            action['page-view'] = {
                previousPath,
                trigger: event?.type ?? "initial",
            };
        }
        emit(action);
        previousPath = location.pathname;
    }
  });
}
