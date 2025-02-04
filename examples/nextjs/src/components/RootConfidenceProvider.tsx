'use client';

import { ConfidenceProvider } from '@spotify-confidence/react';
import { ReactNode } from 'react';
import { Confidence, visitorIdentity } from '@spotify-confidence/sdk';

//make sure to set up .env file to read the secret from
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

//uncomment if you want to test the new_button_style_visitor behaviour
//cf.setContext({visitor_id: 'new_button_style_visitor'})

cf.setContext({ visitor_id: 'default_button_style_visitor' });

//uncomment if you want to use the generated visitorIdentify in your context
//cf.setContext({ visitor_id: visitorIdentity().toString() })

type RootConfidenceProviderProps = {
  children: ReactNode;
};

export default function RootConfidenceProvider({ children }: RootConfidenceProviderProps) {
  return <ConfidenceProvider confidence={cf}>{children}</ConfidenceProvider>;
}
