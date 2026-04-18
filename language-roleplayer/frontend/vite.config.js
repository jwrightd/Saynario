import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
        // Don't let a backend crash kill the Vite dev process
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Suppress EPIPE / ECONNRESET noise — backend may have restarted
            if (!['EPIPE', 'ECONNRESET', 'ECONNREFUSED'].includes(err.code)) {
              console.error('[vite proxy]', err.message);
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'build',
  },
});
