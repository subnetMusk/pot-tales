import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: 'public',
  resolve: {
    alias: {
      '@scripts': path.resolve(__dirname, 'scripts'),
      '@scene': path.resolve(__dirname, 'scene'),
      '@src': path.resolve(__dirname, './')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'public/index.html')
    }
  }
})