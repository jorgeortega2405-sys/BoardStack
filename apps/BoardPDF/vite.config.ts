import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    copyPublicDir: false,
    cssCodeSplit: true,
    cssMinify: true,
    emptyOutDir: true,
    minify: 'esbuild',
    outDir: 'dist/client',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
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
    watch: {
      binaryInterval: 1000,
      ignored: [
        '**/.git/**',
        '**/board-wasm/**',
        '**/collab-server/**',
        '**/data/**',
        '**/dist/**',
        '**/logs/**',
        '**/node_modules/**',
        '**/public/uploads/**',
        '**/scripts/**',
        '**/target/**',
        '**/tests/**',
      ],
      interval: 500,
      usePolling: true,
    },
  },
});
