import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfidenceClient } from '@spotify-confidence/sdk';
import { ConfidenceProvider, useFlag, useFlagDetails } from '@spotify-confidence/react';

async function main() {
  // Vite exposes this value to browsers: only use a browser-distributable secret.
  const clientSecret = import.meta.env.VITE_CONFIDENCE_CLIENT_SECRET;
  if (!clientSecret) throw new Error('Set VITE_CONFIDENCE_CLIENT_SECRET before starting the example');
  const client = new ConfidenceClient({ clientSecret });
  const bundle = await client.resolve([], { targeting_key: 'example-user' }, { apply: false });

  function App() {
    const enabled = useFlag('checkout.enabled', false);
    const { value, expose } = useFlagDetails('checkout.label', 'Checkout', { expose: false });
    return (
      <main>
        <h1>Confidence bundle hooks</h1>
        <p>Checkout enabled: {String(enabled)}</p>
        <button
          onClick={() => {
            void expose().catch(console.error);
          }}
        >
          {value}
        </button>
        <p>Configure checkout.enabled and checkout.label, or edit the example to use your flags.</p>
      </main>
    );
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ConfidenceProvider bundle={bundle} apply={flag => client.apply(bundle.resolveToken, flag)}>
        <App />
      </ConfidenceProvider>
    </StrictMode>,
  );
}

void main().catch(error => {
  document.getElementById('root')!.textContent = String(error);
});
