import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    copyPublicDir: true,
    cssCodeSplit: true,
    cssMinify: true,
    emptyOutDir: true,
    minify: 'esbuild',
    outDir: 'dist/client',
    target: 'es2022',
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@client': path.resolve(import.meta.dirname, 'client'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
});
