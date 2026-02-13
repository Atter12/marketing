import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.jsx';

const base = import.meta.env.BASE_URL || '/';
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) favicon.href = base + 'favicon/favicon.png';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);
