import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

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
    // process.emitWarning is polyfilled in index.html, no need to define it here
    global: 'globalThis'
  },
  build: {
    // Optimize chunk size - increased threshold since we're splitting better
    chunkSizeWarningLimit: 600,
    // Ensure proper module resolution and chunk ordering
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      // Exclude API files from client build
      external: (id) => {
        // More performant and specific check for API files
        if (id.includes('node_modules')) return false;
        
        // Exclude all API routes
        if (id.startsWith('/api/') || id.includes('/api/')) {
          return id.endsWith('.ts') || id.endsWith('.js');
        }
        
        // Exclude server-only Firebase Admin files from client bundle
        // Check for both forward and backslash paths (Windows/Unix compatibility)
        if (id.includes('/lib/firebase-admin') || id.includes('\\lib\\firebase-admin') ||
            id.includes('/server/firebase-admin') || id.includes('\\server\\firebase-admin') ||
            id.includes('/server/') || id.includes('\\server\\') ||
            id.includes('firebase-admin-db') ||
            id.includes('firebase-admin-db.js') ||
            id.includes('firebase-admin-db.ts')) {
          return true;
        }
        
        // Exclude server-side service files that import firebase-admin-db
        // These should only be used in API routes, not in client code
        if (id.includes('/services/firebase-user-service') ||
            id.includes('/services/firebase-vehicle-service') ||
            id.includes('/services/firebase-conversation-service') ||
            id.includes('\\services\\firebase-user-service') ||
            id.includes('\\services\\firebase-vehicle-service') ||
            id.includes('\\services\\firebase-conversation-service')) {
          return true;
        }
        
        // Exclude models directory from client bundle (server-side only)
        if (id.includes('/models/') && (id.endsWith('.ts') || id.endsWith('.js'))) {
          return true;
        }
        return false;
      },
      output: {
        // More aggressive code splitting for better performance
        manualChunks: (id) => {
          // FIX: React must be in the vendor chunk so other libraries (like framer-motion) 
          // that depend on it can access React.createContext when they load
          // Check for React-related modules first, before any other node_modules checks
          if (id.includes('node_modules')) {
            // Check for React first - put in vendor chunk so dependent libraries can access it
            if (id.includes('/react/') || 
                id.includes('/react-dom/') ||
                id.includes('/react\\') ||
                id.includes('/react-dom\\') ||
                id.includes('react/index') ||
                id.includes('react-dom/index') ||
                id.includes('react/jsx-runtime') ||
                id.includes('react/jsx-dev-runtime') ||
                id.includes('scheduler')) {
              // Return 'vendor' to ensure React is bundled with libraries that depend on it
              // This prevents "createContext is undefined" errors in split chunks
              return 'vendor';
            }
            
            // Separate heavy libraries into their own chunks for better caching
            if (id.includes('firebase')) {
              return 'firebase';
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
            // Split framer-motion into its own chunk (large animation library)
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            // Group smaller utility libraries together
            if (id.includes('bcryptjs') || id.includes('validator') || id.includes('dompurify')) {
              return 'utils-vendor';
            }
            // All other node_modules go to vendor chunk
            return 'vendor';
          }
          
          // Split by feature/route for better caching and lazy loading
          // More granular splitting to reduce individual chunk sizes
          if (id.includes('/components/Dashboard')) {
            return 'dashboard';
          }
          // Split admin panel into smaller chunks
          if (id.includes('/components/AdminPanel')) {
            return 'admin';
          }
          if (id.includes('/components/NewCarsAdmin') || id.includes('/components/SellCarAdmin')) {
            return 'admin-extended';
          }
          if (id.includes('/components/VehicleList') || id.includes('/components/VehicleDetail')) {
            return 'vehicles';
          }
          if (id.includes('/components/Home')) {
            return 'home';
          }
          if (id.includes('/components/Profile') || id.includes('/components/Login') || id.includes('/components/UnifiedLogin')) {
            return 'auth';
          }
          if (id.includes('/components/ChatWidget') || id.includes('/components/CustomerInbox')) {
            return 'chat';
          }
          // Split large components into separate chunks
          if (id.includes('/components/SellCarPage') || id.includes('/components/NewCars')) {
            return 'sell-car';
          }
          if (id.includes('/components/BuyerDashboard') || id.includes('/components/SellerProfilePage')) {
            return 'user-pages';
          }
          // Split mobile components into separate chunk (large bundle)
          if (id.includes('/components/Mobile')) {
            return 'mobile-components';
          }
          // Split AppProvider (large context provider)
          if (id.includes('/components/AppProvider')) {
            return 'app-provider';
          }
          
          // Split constants by type for better lazy loading
          // Only split if the module is actually imported (not just referenced)
          if (id.includes('/constants/location')) {
            return 'constants-location';
          }
          // Plans and boost are dynamically imported, so don't create separate chunks
          // They'll be included in the chunks that actually use them
          if (id.includes('/constants/fallback')) {
            return 'constants-fallback';
          }
          // Group all other constants together to avoid empty chunks
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
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // Multiple passes for better compression
        dead_code: true,
        unused: true,
        collapse_vars: true,
        reduce_vars: true,
        // Additional aggressive optimizations
        arrows: true,
        arguments: true,
        booleans: true,
        if_return: true,
        join_vars: true,
        loops: true,
        sequences: true,
        properties: true,
        computed_props: true,
        hoist_funs: true,
        hoist_vars: false, // Keep false to avoid issues
        keep_infinity: true,
      },
      format: {
        comments: false,
        // Optimize output
        ecma: 2020,
        safari10: true,
      },
      mangle: {
        safari10: true,
        properties: false, // Keep properties unmangled for React components
      },
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: true,
    // Disable source maps for production (faster builds, smaller bundles)
    sourcemap: process.env.NODE_ENV === 'development',
    // Better browser support - use modern ES for smaller bundles
    target: 'es2020',
    // Enable asset inlining for small files (reduces HTTP requests)
    assetsInlineLimit: 8192,
    // Optimize for faster loading
    reportCompressedSize: false,
    // Improve build performance
    modulePreload: {
      polyfill: false, // Modern browsers don't need polyfill
    },
    // Additional optimizations
    assetsDir: 'assets',
    emptyOutDir: true,
  },
  server: {
    port: 5173,  // FIXED: Changed from 5174 to standard Vite port 5173
    // Development server optimizations
    hmr: {
      overlay: true,
      // Improve WebSocket connection reliability
      protocol: 'ws',
      host: 'localhost',
      clientPort: 5173
      // Note: reconnect is handled automatically by Vite
      // WebSocket errors in console are harmless - they occur when HMR reconnects
    },
    // Enable file system caching for faster rebuilds
    fs: {
      cachedChecks: true,
      // Exclude API files from file system watching
      deny: ['**/api/**']
    },
    // Optimize development server performance
    warmup: {
      clientFiles: ['./App.tsx', './components/Header.tsx', './components/Home.tsx']
    },
    // Proxy API requests to development server (dev-api-server.js runs on port 3001)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        // CRITICAL FIX: Add timeout and better error handling
        timeout: 30000, // 30 second timeout
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error('❌ API Proxy Error:', err.message);
            console.error('   Request URL:', req.url);
            console.error('   Error Code:', (err as any).code);
            console.warn('⚠️ Make sure the API server is running on port 3001: npm run dev:api');
            
            // CRITICAL FIX: Send proper error response instead of hanging
            if (!res.headersSent) {
              res.writeHead(503, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({
                success: false,
                error: 'Service Unavailable',
                reason: 'API server is not running. Please start it with: npm run dev:api',
                message: err.message
              }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('→ API Request:', req.method, req.url);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('← API Response:', proxyRes.statusCode, req.url);
            }
          });
          // CRITICAL FIX: Handle connection issues
          proxy.on('close', (res, socket, head) => {
            // Debug logging (only in development with DEBUG_ENDPOINT configured)
            if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_ENDPOINT) {
              try {
                fetch(process.env.DEBUG_ENDPOINT, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    location: 'vite.config.ts:304',
                    message: 'Vite proxy connection closed',
                    data: { hasRes: !!res },
                    timestamp: Date.now(),
                  })
                }).catch(() => {});
              } catch {
                // Silently fail if debug endpoint is unavailable
              }
            }
            if (process.env.NODE_ENV === 'development') {
              console.warn('⚠️ Proxy connection closed');
            }
          });
        },
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion', 'socket.io-client'],
    // Exclude heavy dependencies from pre-bundling
    exclude: ['@google/genai', 'mongodb', 'mongoose'],
    // Force optimization of specific packages
    esbuildOptions: {
      target: 'es2020',
    },
  },
  // Enable esbuild optimizations in dev mode
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
