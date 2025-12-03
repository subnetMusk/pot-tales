import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return defineConfig({
    base: '/sandbox/',
    publicDir: 'public',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@scenes': path.resolve(__dirname, '../frontend/src/scenes'),
        '@items': path.resolve(__dirname, '../frontend/src/items'),
        '@network': path.resolve(__dirname, '../frontend/src/network'),
        '@assets': path.resolve(__dirname, '../frontend/src/assets'),
      },
    },

    define: {
      __API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
      __SANDBOX_MODE__: 'true',
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
    }
  });
};
