import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Every /api call from the browser is forwarded to the backend gateway
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
