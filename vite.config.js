import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * 刻意移除了 unplugin-auto-import / unplugin-vue-components：
 *   1. 它们属于「工程化便利」，但会掩盖「组件从哪来」这个最基本的问题；
 *   2. 现在所有组件由 src/ui/index.js 显式注册，来源一目了然。
 *
 * /api 依然走 Vite 代理，但同时也给后端配好了 CORS（真跨域可在设置页验证）。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router']
        }
      }
    }
  }
})
