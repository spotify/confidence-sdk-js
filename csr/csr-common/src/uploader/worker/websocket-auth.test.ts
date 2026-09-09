import { describe, expect, it } from 'vitest';
import { RECORDING_PROTOCOL, recordingProtocols } from './websocket-auth';

describe('recordingProtocols', () => {
  it('encodes an ASCII session token as unpadded base64url', () => {
    expect(recordingProtocols('tok-1')).toEqual(['recording.v1', 'auth.dG9rLTE']);
  });

  it('encodes the UTF-8 bytes of a Unicode session token', () => {
    expect(recordingProtocols('¥€𐍈')).toEqual(['recording.v1', 'auth.wqXigqzwkI2I']);
  });

  it('allows an encoded credential at the 4096-character limit', () => {
    expect(recordingProtocols('a'.repeat(3072))[1]).toHaveLength('auth.'.length + 4096);
  });

  it('rejects an encoded credential longer than 4096 characters without exposing it', () => {
    const token = `sensitive-${'a'.repeat(3073)}`;
    const encoded = 'c2Vuc2l0aXZlLQ';

    expect(() => recordingProtocols(token)).toThrowError('Session token is too long for WebSocket authentication');

    try {
      recordingProtocols(token);
    } catch (error) {
      expect(String(error)).not.toContain(token);
      expect(String(error)).not.toContain(encoded);
    }
  });

  it('exports the protocol selected by a successful server handshake', () => {
    expect(RECORDING_PROTOCOL).toBe('recording.v1');
  });
});
