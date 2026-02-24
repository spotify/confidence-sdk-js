export namespace Signals {
  const anyPolyfill: (typeof AbortSignal)['any'] = signals => {
    const controller = new AbortController();
    const abort = () => {
      controller.abort();
      clear();
    };
    const clear = () => {
      signals.forEach(signal => {
        signal.removeEventListener('abort', abort);
      });
    };
    for (const signal of signals) {
      if (signal.aborted) {
        abort();
        break;
      }
      signal.addEventListener('abort', abort);
    }
    return controller.signal;
  };

  const timeoutPolyfill: (typeof AbortSignal)['timeout'] = milliseconds => {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort(new DOMException('signal timed out', 'TimeoutError'));
    }, milliseconds);
    return controller.signal;
  };

  export const any = typeof AbortSignal.any === 'function' ? AbortSignal.any : anyPolyfill;
  export const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout : timeoutPolyfill;
}
