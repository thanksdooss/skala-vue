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
    open: false,
  },
  build: {
    outDir: 'dist',
  },
  test: {
    // physics 모듈은 DOM을 쓰지 않는다. Vessel.js도 Node에서 그대로 돌아가므로
    // WebGL 모킹 없이 node 환경에서 그대로 테스트한다.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/physics/**/*.ts'],
      exclude: ['src/physics/index.ts', 'src/physics/types.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
})
