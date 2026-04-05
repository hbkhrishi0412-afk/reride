import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Capacitor WebView needs a relative base so `./assets/...` resolves next to
// index.html. Vite dev and normal web deploys need `/` so the entry script,
// HMR (`/@vite/client`), and `/assets/*` work reliably (including SPA refresh
// on nested routes).
const capacitor =
  process.env.CAPACITOR_BUILD === '1' || process.env.CAPACITOR_BUILD === 'true'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localApiPort = String(
    env.VITE_LOCAL_API_PORT || process.env.VITE_LOCAL_API_PORT || '3001'
  ).replace(/^:/, '')

  return {
  base: capacitor ? './' : '/',
  plugins: [react()],
  // Default bind is loopback-only — Android Emulator cannot reach that via 10.0.2.2.
  // Use http://10.0.2.2:<port> in the emulator browser; use your PC's LAN IP on a physical device.
  server: {
    host: true,
    port: 5173,
    // `dev-api-server.js` serves `/api/*` on 3001; without this, `/api/*` on :5173 404s and the SPA breaks.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${localApiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2020',
    ...(capacitor
      ? {
          // ESM + Rollup code-splitting so React.lazy() routes are separate chunks.
          // The old single IIFE (~4MB+) was very slow to parse on mobile WebViews.
          chunkSizeWarningLimit: 1200,
        }
      : {
          rollupOptions: {
            output: {
              manualChunks: undefined,
              format: 'iife',
              entryFileNames: 'assets/[name].js',
              chunkFileNames: 'assets/[name].js',
              assetFileNames: 'assets/[name].[ext]',
            },
          },
        }),
  },
}
})
