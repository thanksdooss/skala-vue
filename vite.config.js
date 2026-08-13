import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/weather': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, '')
      },
      '/api/radar': {
        target: 'http://www.kma.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/radar/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
  },
})
