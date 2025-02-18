'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function CookieControls({ refresh = true }) {
  const router = useRouter();
  const clearVisitorId = () => {
    document.cookie = 'visitor.id=; expires=Thu, 01 Jan 1970 00:00:00 UTC';
    if (refresh) router.refresh();
  };
  const setVisitorId = (value: string) => {
    document.cookie = 'visitor.id=' + value;
    if (refresh) router.refresh();
  };
  return (
    <fieldset>
      <legend>Cookie Controls</legend>
      <button onClick={() => setVisitorId('andreas')}>Set visitor.id to andreas</button>
      <button onClick={() => setVisitorId('nicky')}>Set visitor.id to nicky</button>
      <button onClick={clearVisitorId}>Clear visitor.id</button>
    </fieldset>
  );
}
