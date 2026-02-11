import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/credito-app/',
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
