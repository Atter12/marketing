import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  plugins: [react(), authConfigPlugin()],
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
