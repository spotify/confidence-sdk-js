'use client';

import { useStringValue } from '@spotify-confidence/integration-next';
import {OpenFeature} from "@openfeature/web-sdk";
import {useEffect} from "react";



export function ClientComponent() {
  const str = useStringValue('web-sdk-e2e-flag.str', 'default');

  useEffect(() => {
    OpenFeature.setContext({...})
  }, []);

  return <p>I'm in the client {str}</p>;
}
