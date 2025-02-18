import Link from 'next/link';
import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('RootLayout');
  return (
    <html lang="en">
      <body style={{ fontSize: '20px' }}>
        <ul style={{ display: 'flex', gap: '2em' }}>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="/server-only">Server only</Link>
          </li>
          <li>
            <Link href="/client-only">Client only</Link>
          </li>
          <li>
            <Link href="/server-and-client">Isomorphic</Link>
          </li>
          <li>
            <Link href="/learnings">Learnings</Link>
          </li>
        </ul>
        <div>{children}</div>
      </body>
    </html>
  );
}
