import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
    // PWA plugin disabled to prevent service worker caching issues
  ],
  // Exclude API files and server-side dependencies from client bundling
  define: {
    // Prevent server-side code from being bundled in client
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    global: 'globalThis'
  },
  build: {
    // Optimize chunk size - lower threshold to catch bloat earlier
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      // Exclude API files from client build
      external: (id) => {
        // More performant and specific check for API files
        if (id.includes('node_modules')) return false;
        if (id.startsWith('/api/') || id.includes('/api/')) {
          return id.endsWith('.ts') || id.endsWith('.js');
        }
        return false;
      },
      output: {
        // More aggressive code splitting for better performance
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Separate heavy libraries into their own chunks
            if (id.includes('firebase')) {
              return 'firebase';
            }
            // Keep React and React-DOM in the main bundle to prevent undefined errors
            // React must be available when createContext and other React APIs are called
            if (id.includes('react') || id.includes('react-dom')) {
              // Don't split React - keep it in the main bundle for reliability
              return undefined;
            }
            if (id.includes('chart.js') || id.includes('react-chartjs')) {
              return 'charts';
            }
            if (id.includes('@google/genai')) {
              return 'gemini';
            }
            if (id.includes('react-window')) {
              return 'react-window';
            }
            // Group smaller libraries together
            if (id.includes('bcryptjs') || id.includes('validator') || id.includes('dompurify')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
          
          // Split by feature/route for better caching and lazy loading
          if (id.includes('/components/Dashboard')) {
            return 'dashboard';
          }
          if (id.includes('/components/AdminPanel')) {
            return 'admin';
          }
          if (id.includes('/components/VehicleList') || id.includes('/components/VehicleDetail')) {
            return 'vehicles';
          }
          if (id.includes('/components/Home')) {
            return 'home';
          }
          if (id.includes('/components/Profile') || id.includes('/components/Login')) {
            return 'auth';
          }
          if (id.includes('/components/ChatWidget') || id.includes('/components/CustomerInbox')) {
            return 'chat';
          }
          
          // Split constants by type for better lazy loading
          if (id.includes('/constants/location')) {
            return 'constants-location';
          }
          if (id.includes('/constants/plans')) {
            return 'constants-plans';
          }
          if (id.includes('/constants/fallback')) {
            return 'constants-fallback';
          }
          if (id.includes('/constants/boost')) {
            return 'constants-boost';
          }
          if (id.includes('/constants/') || id.includes('/data/')) {
            return 'constants';
          }
          
          // Split services by functionality
          if (id.includes('/services/vehicleService')) {
            return 'service-vehicle';
          }
          if (id.includes('/services/userService')) {
            return 'service-user';
          }
          if (id.includes('/services/geminiService')) {
            return 'service-gemini';
          }
          if (id.includes('/services/')) {
            return 'services';
          }
          
          // Split utils
          if (id.includes('/utils/')) {
            return 'utils';
          }
        },
        // Optimize chunk names for better caching - hash changes on every build
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Use terser for better minification (smaller bundle size)
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Remove console logs and debugger in production for smaller bundle
    esbuild: {
      drop: ['console', 'debugger'],
      legalComments: 'none',
      // Optimize for better performance
      treeShaking: true,
      target: 'es2020'
    },
    // Optimize CSS
    cssMinify: true,
    // Disable source maps for production
    sourcemap: false,
    // Better browser support
    target: 'es2020',
    // Reduce chunk size
    cssCodeSplit: true,
    // Enable asset inlining for small files
    assetsInlineLimit: 4096,
    // Optimize for faster loading
    reportCompressedSize: false
  },
  server: {
    port: 5174,
    // Development server optimizations
    hmr: {
      overlay: true
    },
    // Enable file system caching for faster rebuilds
    fs: {
      cachedChecks: true,
      // Exclude API files from file system watching
      deny: ['**/api/**']
    },
    // Optimize development server performance
    warmup: {
      clientFiles: ['./src/App.tsx', './src/components/Header.tsx', './src/components/Home.tsx']
    },
    // Proxy API requests to development server
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
    // Exclude heavy dependencies from pre-bundling
    exclude: ['@google/genai', 'mongodb']
  },
  // Enable esbuild optimizations in dev mode
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
