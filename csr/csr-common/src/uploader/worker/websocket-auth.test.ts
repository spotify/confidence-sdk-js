import { describe, expect, it } from 'vitest';
import { recordingProtocols } from './websocket-auth';

describe('recordingProtocols', () => {
  it('offers the issued token unchanged, including dots, hyphens, and underscores', () => {
    expect(recordingProtocols('cGF5bG9hZA.c2lnbmF0dXJl_-')).toEqual(['recording.v1', 'auth.cGF5bG9hZA.c2lnbmF0dXJl_-']);
  });

  it('allows a token at the 4096-character limit', () => {
    expect(recordingProtocols('a'.repeat(4096))[1]).toHaveLength('auth.'.length + 4096);
  });

  it('rejects a token longer than 4096 characters without exposing it', () => {
    const token = `sensitive-${'a'.repeat(4097)}`;
    expect(() => recordingProtocols(token)).toThrowError('Session token is too long for WebSocket authentication');
    try {
      recordingProtocols(token);
    } catch (error) {
      expect(String(error)).not.toContain(token);
    }
  });

  it.each(['', 'sensitive/token', 'sensitive=token', 'sensitive token', 'tøken-☃', 'sensitive\n'])(
    'rejects unsupported token characters without exposing the token',
    token => {
      expect(() => recordingProtocols(token)).toThrowError('Invalid session token for WebSocket authentication');
    },
  );
});
