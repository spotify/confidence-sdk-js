export const RECORDING_PROTOCOL = 'recording.v1';

const AUTH_PROTOCOL_PREFIX = 'auth.';
const MAX_TOKEN_LENGTH = 4096;

export function recordingProtocols(sessionToken: string): string[] {
  if (sessionToken.length > MAX_TOKEN_LENGTH) {
    throw new Error('Session token is too long for WebSocket authentication');
  }
  // Issued tokens are unpadded Base64URL parts joined by a dot; dev tokens are UUIDs.
  if (!sessionToken || /[^A-Za-z0-9._-]/.test(sessionToken)) {
    throw new Error('Invalid session token for WebSocket authentication');
  }
  return [RECORDING_PROTOCOL, `${AUTH_PROTOCOL_PREFIX}${sessionToken}`];
}
