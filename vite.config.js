import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only proxy: the Caspio API proxy's CORS allows only the deployed origins
// (Caspio / mybiohealth.netlify.app), so a browser on localhost can't fetch it
// directly. In dev we route /api/* through Vite (server-to-server, no browser
// CORS) to the real proxy. In production the app calls the proxy directly.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://kenises-api-proxy.netlify.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
