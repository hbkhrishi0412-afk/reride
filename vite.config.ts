import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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
  define: {
    __RERIDE_CAPACITOR__: JSON.stringify(!!capacitor),
  },
  plugins: [
    {
      name: 'reride-debug-nav-log',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'POST' || req.url !== '/__debug_nav_log') {
            next()
            return
          }
          let raw = ''
          req.on('data', (chunk) => {
            raw += chunk
          })
          req.on('end', () => {
            try {
              const parsed = JSON.parse(raw || '{}')
              const line = `${JSON.stringify(parsed)}\n`
              fs.appendFileSync(path.join(process.cwd(), 'debug-4f3bea.log'), line, 'utf8')
            } catch {
              /* ignore */
            }
            res.statusCode = 204
            res.end()
          })
        })
      },
    },
    react(),
    VitePWA({
      disable: capacitor,
      registerType: 'autoUpdate',
      injectRegister: null,
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp,webmanifest}'],
        navigateFallback: capacitor ? undefined : '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'reride-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      manifest: {
        name: 'ReRide',
        short_name: 'ReRide',
        description: 'Buy and sell quality used vehicles',
        theme_color: '#FF6B35',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
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
    // Default Rollup ESM output with content-hashed filenames on BOTH web and
    // Capacitor builds. This enables React.lazy() code-splitting and lets the
    // `immutable` Cache-Control header on /assets/* be safe (new deploy → new
    // hash → new URL). The old web-only IIFE branch produced a single ~4.6MB
    // bundle and caused stale-cache issues because filenames were unhashed.
    chunkSizeWarningLimit: capacitor ? 1200 : 800,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Split the main vendor bundle into logical groups so a first paint only
        // pulls the code it actually needs. Routes that use maps/charts/i18n
        // don't make every other page wait for those libraries to download.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // React + router + head management — needed on every page
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/') ||
            id.includes('node_modules/react-router/') ||
            id.includes('node_modules/react-helmet-async/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase'
          if (id.includes('node_modules/@tanstack/')) return 'vendor-query'
          if (
            id.includes('node_modules/framer-motion/') ||
            id.includes('node_modules/@emotion/')
          ) {
            return 'vendor-motion'
          }
          if (
            id.includes('node_modules/leaflet') ||
            id.includes('node_modules/react-leaflet/')
          ) {
            return 'vendor-maps'
          }
          if (
            id.includes('node_modules/chart.js/') ||
            id.includes('node_modules/react-chartjs-2/')
          ) {
            return 'vendor-charts'
          }
          if (
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/react-i18next/')
          ) {
            return 'vendor-i18n'
          }
          // NOTE: Do NOT manually chunk @sentry/* — its packages have internal
          // circular imports that, when forced into a single chunk by Rollup,
          // produce a Temporal Dead Zone error in production:
          //   "Cannot access 'da' before initialization" in vendor-sentry-*.js
          // Sentry is loaded via a dynamic import() in utils/monitoring.ts, so
          // Rollup will already create a separate async chunk for it.
          // See: https://github.com/getsentry/sentry-javascript/issues/9435
          if (
            id.includes('node_modules/dompurify/') ||
            id.includes('node_modules/validator/') ||
            id.includes('node_modules/bcryptjs/') ||
            id.includes('node_modules/jsonwebtoken/')
          ) {
            return 'vendor-crypto-sanitize'
          }
          if (id.includes('node_modules/socket.io-client/')) return 'vendor-socket'
          return 'vendor-misc'
        },
      },
    },
  },
}
})
