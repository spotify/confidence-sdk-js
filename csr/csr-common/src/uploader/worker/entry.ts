import { registerPort, type PortAdapter } from './core';

// Branch on which worker context we're running in. SharedWorkerGlobalScope only exists
// at runtime inside a SharedWorker; we feature-detect it via `globalThis`.
const SharedWorkerScopeCtor = (
  globalThis as unknown as {
    SharedWorkerGlobalScope?: new () => unknown;
  }
).SharedWorkerGlobalScope;

const isShared = typeof SharedWorkerScopeCtor === 'function' && self instanceof SharedWorkerScopeCtor;

if (isShared) {
  (self as unknown as SharedWorkerGlobalScope).onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    port.start();
    registerPort(adaptMessagePort(port));
  };
} else {
  registerPort(adaptDedicatedSelf());
}

function adaptMessagePort(port: MessagePort): PortAdapter {
  return {
    postMessage: message => port.postMessage(message),
    onmessage: cb => {
      port.onmessage = (e: MessageEvent) => cb(e.data);
    },
  };
}

function adaptDedicatedSelf(): PortAdapter {
  const ws = self as unknown as DedicatedWorkerGlobalScope;
  return {
    postMessage: message => ws.postMessage(message),
    onmessage: cb => {
      ws.onmessage = (e: MessageEvent) => cb(e.data);
    },
  };
}
