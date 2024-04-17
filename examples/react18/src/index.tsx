import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

_setupGoogleAnalytics();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

function _setupGoogleAnalytics() {
  const script = document.createElement('script');
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-J33MB49R7T';
  script.async = true;
  document.body.appendChild(script);

  // @ts-ignore
  window.dataLayer = [];
  function gtag(...args: any[]) {
    // @ts-ignore
    dataLayer.push(arguments);
  }
  gtag('js', new Date());

  gtag('config', 'G-J33MB49R7T');
}
