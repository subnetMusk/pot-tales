import { defineConfig, loadEnv } from 'vite';
import type { ConfigEnv } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'path';

export default ({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return defineConfig({
    base: env.VITE_BASE_URL || '/',
    publicDir: 'public',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@scenes': path.resolve(__dirname, 'src/scenes'),
        '@items': path.resolve(__dirname, 'src/items'),
        '@network': path.resolve(__dirname, 'src/network'),
        '@assets': path.resolve(__dirname, 'src/assets'),
      },
    },
    define: {
      __API_BASE__: JSON.stringify(env.VITE_API_BASE || '/api'),
    },
    plugins: [
      {
        name: 'prerender-home',
        enforce: 'pre',
        transformIndexHtml(html) {
          const marker = '<!-- POT_TALES_HOME -->';
          if (!html.includes(marker)) {
            throw new Error(`Marker ${marker} mancante in index.html`);
          }

          const home = readFileSync(
            path.resolve(__dirname, 'public/static/pages/homePage.html'),
            'utf8',
          );
          return html.replace(marker, home);
        },
      },
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'esnext',
    },
  });
};
