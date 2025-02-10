import React from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  console.log('RootLayout');
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
