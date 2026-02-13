import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.jsx';

// En dev Vite sirve public en la raíz (/); con base solo los assets del build llevan prefijo
const isDev = import.meta.env.DEV;
const faviconPath = isDev ? '/favicon/favicon.png' : (import.meta.env.BASE_URL || '/') + 'favicon/favicon.png?v=2';
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) favicon.href = faviconPath;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
