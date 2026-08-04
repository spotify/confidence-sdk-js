/**
 * Isomorphic base64 for binary data, used for the resolve token on the wire.
 *
 * Distinct from `utf8ToBase64` in `./utils`, which encodes a string and works in
 * the browser only. These take and return bytes, and work in Node.js, browsers
 * and Workers.
 *
 * This module has no imports on purpose: it is reached for from code that must
 * not depend on the rest of the package.
 */

/** A Node `Buffer`: a `Uint8Array` that can stringify itself to an encoding. */
type NodeBuffer = Uint8Array & { toString(encoding: string): string };

/** The subset of Node's `Buffer` constructor used here. */
type NodeBufferCtor = {
  from(data: string, encoding: string): NodeBuffer;
  from(data: Uint8Array): NodeBuffer;
};

/**
 * Node's `Buffer`, absent in browsers and Workers.
 *
 * Typed here rather than relying on `globalThis` so the package does not need
 * `@types/node` in scope — it also ships to the browser. Read per call rather
 * than once at module scope, so tests can remove it.
 */
function nodeBuffer(): NodeBufferCtor | undefined {
  return (globalThis as { Buffer?: NodeBufferCtor }).Buffer;
}

/** Decode a base64 string to bytes. Uses Buffer in Node.js, `atob` elsewhere. */
export function bytesFromBase64(b64: string): Uint8Array {
  const buffer = nodeBuffer();
  if (buffer) {
    return Uint8Array.from(buffer.from(b64, 'base64'));
  }
  const bin = globalThis.atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; ++i) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

/** Encode bytes to a base64 string. Uses Buffer in Node.js, `btoa` elsewhere. */
export function base64FromBytes(arr: Uint8Array): string {
  const buffer = nodeBuffer();
  if (buffer) {
    return buffer.from(arr).toString('base64');
  }
  const bin: string[] = [];
  arr.forEach(byte => {
    bin.push(String.fromCharCode(byte));
  });
  return globalThis.btoa(bin.join(''));
}
