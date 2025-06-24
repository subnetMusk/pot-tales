import { defineConfig, loadEnv } from 'vite';
import path from 'path';

export default ({ mode }) => {
  // Carica le env VITE_* da sandbox/.env
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return defineConfig({
    root: 'public', // entrypoint HTML e script in public/
    resolve: {
      alias: {
        // Riusa tutta la logica del client
        '@': path.resolve(__dirname, 'src'),
        '@scenes': path.resolve(__dirname, '../client/src/scenes'),
        '@items': path.resolve(__dirname, '../client/src/items'),
        '@network': path.resolve(__dirname, '../client/src/network'),
        '@assets': path.resolve(__dirname, '../client/src/assets')
      }
    },
    define: {
      // Base per le chiamate API
      __API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
      // Flag per modalità sandbox
      __SANDBOX_MODE__: 'true'
    },
    server: {
      host: true,
      port: Number(env.VITE_PORT) || 5173,
      proxy: {
        // Percorso standard verso il game-server
        '/api/': {
          target: env.VITE_API_SERVER || 'http://phaser-server:3000',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/api/, '/api')
        },
        // Endpoint dedicati per le custom-scenes
        '/sandbox-api/': {
          target: env.VITE_API_SERVER || 'http://phaser-server:3000',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/sandbox-api/, '/api/custom-scenes')
        }
      }
    }
  });
};
