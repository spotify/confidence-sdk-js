'use client';
import dynamic from 'next/dynamic';
import React from 'react';

export const ClientBoundary = dynamic(
  () => Promise.resolve(({ children }: React.PropsWithChildren) => <>{children}</>),
  { ssr: false },
);
