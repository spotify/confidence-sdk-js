export const RECORDING_PROTOCOL = 'recording.v1';

const AUTH_PROTOCOL_PREFIX = 'auth.';
const MAX_ENCODED_CREDENTIAL_LENGTH = 4096;

export function recordingProtocols(sessionToken: string): string[] {
  const bytes = new TextEncoder().encode(sessionToken);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const credential = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (credential.length > MAX_ENCODED_CREDENTIAL_LENGTH) {
    throw new Error('Session token is too long for WebSocket authentication');
  }
  return [RECORDING_PROTOCOL, `${AUTH_PROTOCOL_PREFIX}${credential}`];
}
