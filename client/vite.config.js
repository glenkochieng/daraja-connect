import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In development the client calls /api on its own origin and Vite forwards it to Express,
// so no CORS setup is needed locally. Set API_PROXY_TARGET if the API runs elsewhere.
const apiProxy = {
  '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:4000' },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
