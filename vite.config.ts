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
