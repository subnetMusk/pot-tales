import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default ({ mode }) => {
  // carica le env VITE_*
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return defineConfig({
    // base URL per asset e routing (usalo in caso di proxy o S3 buckets)
    base: env.VITE_BASE_URL || '/',

    // dove sta la tua index.html e le risorse "pubbliche"
    publicDir: 'public',

    resolve: {
      alias: {
        // radice dei sorgenti TS/JS
        '@': path.resolve(__dirname, 'src'),
        // cartelle specifiche
        '@scenes': path.resolve(__dirname, 'src/scenes'),
        '@items': path.resolve(__dirname, 'src/items'),
        '@network': path.resolve(__dirname, 'src/network'),
        '@assets': path.resolve(__dirname, 'src/assets'),
      },
    },

    define: {
      // base per le chiamate API client→server
      __API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'public/index.html'),
      },
      // aumenta la velocità di cold start
      target: 'esnext',
    },
  });
};
