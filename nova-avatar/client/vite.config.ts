import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load the monorepo-root .env (shared with the server) so the dev proxy
  // targets whatever PORT the server is configured to use.
  const rootEnv = loadEnv(mode, path.resolve(here, '..'), '');
  const port = rootEnv.PORT || '8787';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${port}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // three.js is ~700 kB on its own and lives in its own vendor chunk below.
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three', '@pixiv/three-vrm'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
