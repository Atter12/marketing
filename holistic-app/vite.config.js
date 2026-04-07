import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync, createReadStream, existsSync, statSync } from 'fs';
import { dirname, join, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Sirve `marketing/finanzas/` en dev bajo `/finanzas/*` (mismo origen que en Vercel). */
function serveFinanzasFromRepo() {
  const finRoot = resolve(__dirname, '..', 'finanzas');
  return {
    name: 'serve-finanzas-repo',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split('?')[0] || '';
        if (!raw.startsWith('/finanzas')) return next();
        let rel = raw === '/finanzas' || raw === '/finanzas/' ? 'finanzas.html' : raw.slice('/finanzas/'.length);
        if (!rel || rel.includes('..')) return next();
        const fp = resolve(finRoot, normalize(rel));
        if (!fp.startsWith(finRoot) || !existsSync(fp)) return next();
        try {
          if (!statSync(fp).isFile()) return next();
        } catch {
          return next();
        }
        if (fp.endsWith('.html')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
        else if (fp.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        else if (fp.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        createReadStream(fp).on('error', () => next()).pipe(res);
      });
    },
  };
}

function authConfigPlugin() {
  return {
    name: 'auth-config',
    closeBundle() {
      const out = join(__dirname, 'dist', 'credito-app', 'auth-config.js');
      mkdirSync(dirname(out), { recursive: true });
      const url = process.env.PUBLIC_SUPABASE_URL || '';
      const key = process.env.PUBLIC_SUPABASE_ANON_KEY || '';
      const storageApi = process.env.PUBLIC_MARKETING_STORAGE_API || '';
      writeFileSync(
        out,
        `window.__SUPABASE_URL__="${url.replace(/"/g, '\\"')}";window.__SUPABASE_ANON_KEY__="${key.replace(/"/g, '\\"')}";window.__MARKETING_STORAGE_API__="${storageApi.replace(/"/g, '\\"')}";\n`,
        'utf8'
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), authConfigPlugin(), serveFinanzasFromRepo()],
  base: '/credito-app/',
  define: {
    'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(process.env.PUBLIC_SUPABASE_URL ?? ''),
    'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.PUBLIC_SUPABASE_ANON_KEY ?? ''),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'credito-app.js',
        chunkFileNames: 'credito-app.js',
        assetFileNames: 'credito-app.[ext]',
      },
    },
  },
});
