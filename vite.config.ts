import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: true,
    proxy: {
      // Proxy API requests to the Express backend
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Optional: rewrite path if needed (here we keep /api as is)
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});