import type { Frame, Transport } from '../types';

/**
 * WebSocket-backed Transport. Internal retry policy: clean server-initiated close after the
 * first successful open → reconnect and resume; abrupt close (or any close before the first
 * open) → fire `onClose` and stop. Frames received while a (re)connect is in progress are
 * buffered and flushed on open.
 *
 * `ready()` resolves once the server acknowledges authentication and rejects if the connection
 * closes first. Callers should await it before treating the Transport as live, so a stale token
 * can be rejected and recovered from.
 */
export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private onCloseCb: ((info: { reason: string }) => void) | null = null;
  private onStateChangeCb: ((info: { connected: boolean }) => void) | null = null;
  private intentionallyClosed = false;
  private dead = false;
  private authenticated = false;
  /** Frames buffered while a (re)connect is in progress. */
  private pending: Frame[] = [];
  private readyPromise: Promise<void>;

  constructor(private readonly url: string, private readonly sessionToken: string) {
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.connect(false, resolve, reject);
    });
    // Always attach a noop catch so an unawaited failure doesn't surface as an unhandled
    // rejection; callers that care will await `ready()` themselves.
    this.readyPromise.catch(() => {});
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  send(frame: Frame): void {
    if (this.dead || this.intentionallyClosed) return;
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify(frame));
    } else {
      this.pending.push(frame);
    }
  }

  close(reason = 'transport-close'): void {
    this.intentionallyClosed = true;
    this.ws?.close(1000, reason);
  }

  onClose(cb: (info: { reason: string }) => void): void {
    this.onCloseCb = cb;
  }

  onStateChange(cb: (info: { connected: boolean }) => void): void {
    this.onStateChangeCb = cb;
  }

  private connect(isReconnect: boolean, onReady?: () => void, onReadyFail?: (err: Error) => void): void {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    this.authenticated = false;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'authenticate', token: this.sessionToken }));
    };

    ws.onmessage = event => {
      if (this.authenticated || !this.isAuthenticationAck(event.data)) return;
      this.authenticated = true;
      onReady?.();
      // Emit state on every successful open EXCEPT the very first one (welcome already
      // implies connected=true). isReconnect distinguishes those.
      if (isReconnect) {
        this.onStateChangeCb?.({ connected: true });
      }
      while (this.pending.length > 0) {
        const f = this.pending.shift()!;
        ws.send(JSON.stringify(f));
      }
    };

    ws.onclose = event => {
      if (this.intentionallyClosed) return;
      if (!this.authenticated) {
        // Server rejected the connection before acknowledging authentication.
        const stage = isReconnect ? 'reconnect' : 'initial';
        const reason = `${stage}-failed code=${event.code}`;
        if (onReadyFail) {
          // First attempt — surface the failure to whoever is awaiting `ready()` so they
          // can decide whether to recover (e.g. fall back to a fresh initSession).
          onReadyFail(new Error(reason));
          this.dead = true;
        } else {
          // Reconnect failed; the consumer is past `ready()` and only learns about it via onClose.
          this.die(reason);
        }
        return;
      }
      // The WS opened and is now closing. Distinguish graceful drain (retry) from app
      // rejection (terminal). Both can have wasClean=true at the protocol level, so we have
      // to inspect the code: 1000/1001 are lifecycle closes ("come back"), 4xxx are
      // application-level rejections ("don't come back"), anything else (1006 etc.) is
      // abnormal.
      const isGracefulDrain = event.wasClean && (event.code === 1000 || event.code === 1001);
      if (isGracefulDrain) {
        this.onStateChangeCb?.({ connected: false });
        this.connect(true);
      } else {
        this.die(`close code=${event.code} wasClean=${event.wasClean}`);
      }
    };
  }

  private die(reason: string): void {
    this.dead = true;
    this.onCloseCb?.({ reason });
  }

  private isAuthenticationAck(data: unknown): boolean {
    if (typeof data !== 'string') return false;
    try {
      return (JSON.parse(data) as { type?: unknown }).type === 'authenticated';
    } catch (_error) {
      return false;
    }
  }
}
