import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
  },
});
