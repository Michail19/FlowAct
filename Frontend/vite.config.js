/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const executionApiProxyTarget =
      env.VITE_DEV_EXECUTION_API_PROXY_TARGET || 'http://localhost:8082'

  const userApiProxyTarget =
      env.VITE_DEV_USER_API_PROXY_TARGET || 'http://localhost:8083'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/v1/auth': {
          target: userApiProxyTarget,
          changeOrigin: true,
        },
        '/api/v1/users': {
          target: userApiProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: executionApiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
