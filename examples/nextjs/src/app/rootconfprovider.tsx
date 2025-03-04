'use client';

import { ConfidenceProvider } from '@spotify-confidence/react';
import { ReactNode } from 'react';
import { Confidence, visitorIdentity } from '@spotify-confidence/sdk';

if (!process.env.NEXT_PUBLIC_REACT_APP_CLIENT_SECRET) {
  console.error('NEXT_PUBLIC_REACT_APP_CLIENT_SECRET not set in .env');
  process.exit(1);
}

const cf = Confidence.create({
  clientSecret: process.env.NEXT_PUBLIC_REACT_APP_CLIENT_SECRET,
  environment: 'client',
  region: 'eu',
  timeout: 1000,
  logger: console,
});

cf.track(visitorIdentity());
//cf.setContext({visitor_id: 'new_button_style_visitor'})
cf.setContext({ visitor_id: 'default_button_style_visitor' });
//cf.setContext({ visitor_id: visitorIdentity().toString() })

type RootConfProviderProps = {
  children: ReactNode;
};

export default function RootConfProvider({ children }: RootConfProviderProps) {
  return <ConfidenceProvider confidence={cf}>{children}</ConfidenceProvider>;
}
