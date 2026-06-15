import {
  RecordingEvent,
  RecordingEventType,
  type TabVisibilityPluginData,
  type NetworkRequestPluginData,
  type RouteChangePluginData,
  type RouteChangeTrigger,
} from '@spotify-confidence/csr-common';
import { RecorderOptions, RecorderState, RecordingConfig } from './types';
import { RecordingEngine } from './engine';

export class Recorder {
  private readonly engine: RecordingEngine;
  private readonly onEvent: (event: RecordingEvent) => void;
  private state: RecorderState = RecorderState.Idle;
  private visibilityHandler: (() => void) | null = null;
  private originalFetch: typeof globalThis.fetch | null = null;
  private originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateHandler: (() => void) | null = null;

  constructor(options: RecorderOptions) {
    this.engine = options.engine;
    this.onEvent = options.onEvent;
  }

  get currentState(): RecorderState {
    return this.state;
  }

  start(config?: RecordingConfig): void {
    if (this.state === RecorderState.Recording) {
      return;
    }
    this.state = RecorderState.Recording;
    this.engine.start(config ?? {}, event => {
      this.onEvent(event);
    });

    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        const data: TabVisibilityPluginData = {
          plugin: 'csr:tabVisibility',
          payload: { hidden: document.hidden },
        };
        this.onEvent({
          type: RecordingEventType.Plugin,
          timestamp: Date.now(),
          data,
        });
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    if (config?.captureNetworkRequests) {
      this.patchNetwork();
    }

    if (config?.captureRouteChanges !== false) {
      this.patchRouting();
    }
  }

  private emitNetworkRequest(payload: NetworkRequestPluginData['payload']): void {
    const data: NetworkRequestPluginData = {
      plugin: 'csr:networkRequest',
      payload,
    };
    this.onEvent({
      type: RecordingEventType.Plugin,
      timestamp: Date.now(),
      data,
    });
  }

  private patchNetwork(): void {
    this.patchFetch();
    this.patchXhr();
  }

  private patchFetch(): void {
    if (typeof globalThis.fetch !== 'function') return;
    const originalFetch = globalThis.fetch;
    this.originalFetch = originalFetch;
    const emit = this.emitNetworkRequest.bind(this);

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const method = input instanceof Request ? input.method : init?.method ?? 'GET';
      let url: string;
      if (input instanceof Request) {
        url = input.url;
      } else if (input instanceof URL) {
        url = input.href;
      } else {
        url = String(input);
      }
      const requestSize = init?.body ? new Blob([init.body as BlobPart]).size : undefined;
      const start = Date.now();

      return originalFetch.call(globalThis, input, init).then(
        response => {
          const contentLength = response.headers.get('content-length');
          emit({
            initiator: 'fetch',
            method: method.toUpperCase(),
            url,
            status: response.status,
            durationMs: Date.now() - start,
            ...(requestSize !== null && requestSize !== undefined ? { requestSize } : {}),
            ...(contentLength ? { responseSize: Number(contentLength) } : {}),
          });
          return response;
        },
        error => {
          emit({
            initiator: 'fetch',
            method: method.toUpperCase(),
            url,
            status: 0,
            durationMs: Date.now() - start,
            ...(requestSize !== null && requestSize !== undefined ? { requestSize } : {}),
          });
          throw error;
        },
      );
    };
  }

  private patchXhr(): void {
    if (typeof XMLHttpRequest === 'undefined') return;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    this.originalXhrOpen = originalOpen;
    this.originalXhrSend = originalSend;
    const emit = this.emitNetworkRequest.bind(this);

    XMLHttpRequest.prototype.open = function csrOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      (this as unknown as Record<string, unknown>).__csr_method = method;
      (this as unknown as Record<string, unknown>).__csr_url = String(url);
      return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof XMLHttpRequest.prototype.open>);
    };

    XMLHttpRequest.prototype.send = function csrSend(
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = this as unknown as Record<string, unknown>;
      const method = (meta.__csr_method as string) ?? 'GET';
      const url = (meta.__csr_url as string) ?? '';
      const requestSize = body !== null && body !== undefined ? new Blob([body as BlobPart]).size : undefined;
      const start = Date.now();

      this.addEventListener('loadend', function csrLoadend(this: XMLHttpRequest) {
        const contentLength = this.getResponseHeader('content-length');
        emit({
          initiator: 'xhr',
          method: method.toUpperCase(),
          url,
          status: this.status,
          durationMs: Date.now() - start,
          ...(requestSize !== null && requestSize !== undefined ? { requestSize } : {}),
          ...(contentLength ? { responseSize: Number(contentLength) } : {}),
        });
      });

      return originalSend.call(this, body);
    };
  }

  private emitRouteChange(from: string, to: string, trigger: RouteChangeTrigger): void {
    if (from === to) return;
    const data: RouteChangePluginData = {
      plugin: 'csr:routeChange',
      payload: { from, to, trigger },
    };
    this.onEvent({
      type: RecordingEventType.Plugin,
      timestamp: Date.now(),
      data,
    });
  }

  private static currentPathname(): string {
    return window.location.pathname;
  }

  private patchRouting(): void {
    if (typeof window === 'undefined') return;

    let lastUrl = Recorder.currentPathname();

    const emitNav = (trigger: RouteChangeTrigger) => {
      const before = lastUrl;
      lastUrl = Recorder.currentPathname();
      this.emitRouteChange(before, lastUrl, trigger);
    };

    const originalPushState = history.pushState.bind(history);
    this.originalPushState = history.pushState;
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
      originalPushState(...args);
      emitNav('pushState');
    };

    const originalReplaceState = history.replaceState.bind(history);
    this.originalReplaceState = history.replaceState;
    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
      originalReplaceState(...args);
      emitNav('replaceState');
    };

    this.popstateHandler = () => emitNav('popstate');
    window.addEventListener('popstate', this.popstateHandler);
  }

  private restoreRouting(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
  }

  private restoreNetwork(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    if (this.originalXhrOpen) {
      XMLHttpRequest.prototype.open = this.originalXhrOpen;
      this.originalXhrOpen = null;
    }
    if (this.originalXhrSend) {
      XMLHttpRequest.prototype.send = this.originalXhrSend;
      this.originalXhrSend = null;
    }
  }

  stop(): void {
    if (this.state !== RecorderState.Recording) {
      return;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.restoreNetwork();
    this.restoreRouting();
    this.engine.stop();
    this.state = RecorderState.Stopped;
  }
}
