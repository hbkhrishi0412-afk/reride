import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Capacitor WebView needs a relative base so `./assets/...` resolves next to
// index.html. Vite dev and normal web deploys need `/` so the entry script,
// HMR (`/@vite/client`), and `/assets/*` work reliably (including SPA refresh
// on nested routes).
const capacitor =
  process.env.CAPACITOR_BUILD === '1' || process.env.CAPACITOR_BUILD === 'true'

export default defineConfig({
  base: capacitor ? './' : '/',
  plugins: [react()],
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
})
