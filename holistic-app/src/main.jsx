import './holistic-design-system.css';
import './holisticFontDiag.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.jsx';
import Login from './Login.jsx';
import { supabase } from './supabase.js';
import { consumeAuthHashIfPresent } from './authHashBootstrap.js';
import { isAuthBootstrapDebugEnabled, maskLocationHashForLog } from './authDebug.js';

// En dev Vite sirve public en la raíz (/); con base solo los assets del build llevan prefijo
const isDev = import.meta.env.DEV;
const faviconPath = isDev ? '/favicon/favicon.png' : (import.meta.env.BASE_URL || '/') + 'favicon/favicon.png?v=2';
const favicon = document.querySelector('link[rel="icon"]');
if (favicon) favicon.href = faviconPath;

// Si la ruta es /login, mostramos solo el login (para proteger /creativos, /pendientes, etc.)
const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
const isLoginOnly = pathname === '/login';

function getRedirectFromQuery() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (!redirect) return null;
  const path = redirect.startsWith('/') ? redirect : '/' + redirect;
  return window.location.origin + path;
}

function AppRoot() {
  if (isLoginOnly) {
    const redirectTo = getRedirectFromQuery();
    return <Login supabase={supabase} redirectTo={redirectTo || undefined} variant="plataforma" onSuccess={() => {}} />;
  }
  return <AuthGate />;
}

async function logBootstrapAuthStage(label, client) {
  if (!isAuthBootstrapDebugEnabled() || !client || typeof window === 'undefined') return;
  const hashPreview = maskLocationHashForLog(window.location.hash);
  const { data: { session }, error: sErr } = await client.auth.getSession();
  const { data: { user }, error: uErr } = await client.auth.getUser();
  console.log(`[bootstrap] ${label}`, {
    hashPreview,
    hasSession: !!session,
    getSessionError: sErr?.message ?? null,
    userEmail: user?.email ?? null,
    getUserError: uErr?.message ?? null,
  });
}

async function bootstrap() {
  if (typeof window !== 'undefined' && supabase) {
    await logBootstrapAuthStage('before consumeAuthHashIfPresent', supabase);
    await consumeAuthHashIfPresent(supabase);
    await logBootstrapAuthStage('after consumeAuthHashIfPresent', supabase);
  }
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  );
}

bootstrap();
