import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: 'public',
  resolve: {
    alias: {
      '/@scripts': path.resolve(__dirname, 'sandbox/scripts') // alias con "/" per vite
    }
  },
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve('./public/index.html')
    }
  }
})