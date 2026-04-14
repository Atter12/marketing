import { supabase } from './supabase.js';
import { consumeAuthHashIfPresent } from './authHashBootstrap.js';
import { isAuthBootstrapDebugEnabled, maskLocationHashForLog, logAuthLine } from './authDebug.js';
import './holistic-design-system.css';
import './holisticFontDiag.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate.jsx';
import Login from './Login.jsx';

// Windows modo oscuro: sin data-theme, holistic-design-system aplica prefers-color-scheme → Métricas casi negras.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'light');
}

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

function shouldLogBootstrap() {
  if (typeof window === 'undefined') return false;
  if (isAuthBootstrapDebugEnabled()) return true;
  const p = window.location.pathname || '';
  return p === '/credito' || p.startsWith('/credito/');
}

async function logBootstrapAuthStage(label, client) {
  if (!client || typeof window === 'undefined' || !shouldLogBootstrap()) return;
  const hash = window.location.hash || '';
  const verbose = isAuthBootstrapDebugEnabled();
  const { data: { session }, error: sErr } = await client.auth.getSession();
  // Antes de consumeAuthHashIfPresent con hash implícito no hay JWT aún: getUser() devuelve "Auth session missing!" y confunde.
  const skipGetUser =
    label === 'before consumeAuthHashIfPresent' && hash.includes('access_token') && hash.includes('refresh_token');
  let user = null;
  let uErr = null;
  if (!skipGetUser) {
    const { data: { user: u }, error: e } = await client.auth.getUser();
    user = u;
    uErr = e;
  }
  const base = {
    pathname: window.location.pathname,
    hashLen: hash.length,
    includesAccessToken: hash.includes('access_token'),
    hasSession: !!session,
    getSessionError: sErr?.message ?? null,
    ...(skipGetUser ? { getUserSkipped: 'hash_handoff_pending' } : { getUserError: uErr?.message ?? null }),
  };
  if (verbose) {
    logAuthLine(`[bootstrap] ${label}`, { ...base, hashPreview: maskLocationHashForLog(hash), userEmail: user?.email ?? null });
  } else {
    logAuthLine(`[bootstrap] ${label}`, base);
  }
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
