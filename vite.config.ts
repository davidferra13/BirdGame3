import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5300,
    strictPort: true,
    host: true,
    open: true,
  },
  build: {
    // Target modern browsers that support WebGL2
    target: 'es2020',
    // No source maps in production (smaller dist, no source exposure)
    sourcemap: false,
    // Increase chunk warning limit for game bundles
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split Three.js into its own chunk for better caching
        manualChunks: {
          three: ['three'],
        },
      },
    },
    // Inline small assets (< 8kb) to reduce HTTP requests
    assetsInlineLimit: 8192,
  },
  esbuild: {
    // Strip debugger statements in production
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    // Mark console.log/warn as pure so they get tree-shaken in production
    // (keeps console.error for real error reporting on platforms)
    pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.warn'] : [],
  },
});
