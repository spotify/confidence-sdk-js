import React from 'react';
import { ClientComponent } from './ClientComponent';
import { ServerComponent } from './ServerComponent';

export default function Page() {
  return (
    <>
      <ClientComponent>
        <ServerComponent />
      </ClientComponent>
    </>
  );
}
