/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiProxyTarget =
      env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:8082'

  const devUserId =
      env.VITE_DEV_USER_ID || '00000000-0000-0000-0000-000000000001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-User-Id', devUserId)
            })
          },
        },
      },
    },
  }
})
