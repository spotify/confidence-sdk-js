'use client';

import { useStringValue } from '@spotify-confidence/integration-next';

export function ClientComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  return <p>I am in the client {str}</p>;
}
