import React from 'react';
import { clientProvider } from '@/utils/client-provider';
import { ClientComponent } from './client-component';
import { OpenFeature } from '@openfeature/js-sdk';
import { ClientSetup } from "@spotify-confidence/integration-next/Next13";
import {serverProvider} from "@/utils/server-provider";

OpenFeature.setProvider(serverProvider);

export default async function App() {
  const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
    targetingKey: 'user-a',
  });

  return (
    <>
      <ClientSetup
        serializedConfig={serverProvider.serialize()!}
        context={{
          targetingKey: 'user-a',
        }}
        clientProvider={clientProvider}
      />
      <React.Suspense fallback={<p>loading...</p>}>
        <p>I'm server {str}</p>
        <ClientComponent />
      </React.Suspense>
    </>
  );
}


// export default async function App() {
//   const str = await OpenFeature.getClient().getStringValue('web-sdk-e2e-flag.str', 'default', {
//     targetingKey: 'user-a',
//   });
//
//   const clientContext = { targetingKey: 'user-a'};
//
//   const clientConfiguration = await serverProvider.getClientConfiguration(clientContext)
//
//
//   return (
//     <>
//       <ClientSetup
//         clientConfiguration={clientConfiguration}
//         clientProviderFactoryOptions={{
//             clientSecret: 'RxDVTrXvc6op1XxiQ4OaR31dKbJ39aYV',
//             region: 'eu',
//             fetchImplementation: window.fetch.bind(window),
//             apply: {
//                 timeout: 1000,
//             },
//         }}
//       />
//       <React.Suspense fallback={<p>loading...</p>}>
//         <p>I'm server {str}</p>
//         <ClientComponent />
//       </React.Suspense>
//     </>
//   );
// }