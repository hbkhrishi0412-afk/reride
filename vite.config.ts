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
    // process.emitWarning is polyfilled in index.html, no need to define it here
    global: 'globalThis'
  },
  build: {
    // Optimize chunk size - lower threshold to catch bloat earlier
    chunkSizeWarningLimit: 500,
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
        if (id.startsWith('/api/') || id.includes('/api/')) {
          return id.endsWith('.ts') || id.endsWith('.js');
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
            
            // Separate heavy libraries into their own chunks
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
            // Group smaller libraries together
            if (id.includes('bcryptjs') || id.includes('validator') || id.includes('dompurify')) {
              return 'utils-vendor';
            }
            // All other node_modules go to vendor chunk
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
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // Multiple passes for better compression
        dead_code: true,
        unused: true,
        collapse_vars: true,
        reduce_vars: true,
      },
      format: {
        comments: false,
      },
      mangle: {
        safari10: true,
      },
    },
    // Remove console logs and debugger in production for smaller bundle
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: true,
    // Disable source maps for production (faster builds, smaller bundles)
    sourcemap: process.env.NODE_ENV === 'development',
    // Better browser support
    target: 'es2020',
    // Enable asset inlining for small files (reduces HTTP requests)
    assetsInlineLimit: 8192,
    // Optimize for faster loading
    reportCompressedSize: false,
    // Improve build performance
    modulePreload: {
      polyfill: false, // Modern browsers don't need polyfill
    },
  },
  server: {
    port: 5173,  // FIXED: Changed from 5174 to standard Vite port 5173
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
      clientFiles: ['./App.tsx', './components/Header.tsx', './components/Home.tsx']
    },
    // Proxy API requests to development server (dev-api-server.js runs on port 3001)
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('API Proxy Error:', err.message);
            console.warn('⚠️ Make sure the API server is running: npm run dev:api');
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
        },
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'framer-motion'],
    // Exclude heavy dependencies from pre-bundling
    exclude: ['@google/genai', 'mongodb', 'mongoose']
  },
  // Enable esbuild optimizations in dev mode
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
