// vite.config.ts
import { defineConfig } from "file:///C:/Users/bhadr/Downloads/reride%20(2)/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/bhadr/Downloads/reride%20(2)/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react()
    // PWA plugin disabled to prevent service worker caching issues
  ],
  // Exclude API files and server-side dependencies from client bundling
  define: {
    // Prevent server-side code from being bundled in client
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    // process.emitWarning is polyfilled in index.html, no need to define it here
    global: "globalThis"
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
        if (id.includes("node_modules")) return false;
        if (id.startsWith("/api/") || id.includes("/api/")) {
          return id.endsWith(".ts") || id.endsWith(".js");
        }
        if (id.includes("/lib/firebase-admin") || id.includes("\\lib\\firebase-admin") || id.includes("/server/firebase-admin") || id.includes("\\server\\firebase-admin") || id.includes("/server/") || id.includes("\\server\\") || id.includes("firebase-admin-db") || id.includes("firebase-admin-db.js") || id.includes("firebase-admin-db.ts")) {
          return true;
        }
        if (id.includes("/services/firebase-user-service") || id.includes("/services/firebase-vehicle-service") || id.includes("/services/firebase-conversation-service") || id.includes("\\services\\firebase-user-service") || id.includes("\\services\\firebase-vehicle-service") || id.includes("\\services\\firebase-conversation-service")) {
          return true;
        }
        if (id.includes("/models/") && (id.endsWith(".ts") || id.endsWith(".js"))) {
          return true;
        }
        return false;
      },
      output: {
        // More aggressive code splitting for better performance
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react\\") || id.includes("/react-dom\\") || id.includes("react/index") || id.includes("react-dom/index") || id.includes("react/jsx-runtime") || id.includes("react/jsx-dev-runtime") || id.includes("scheduler")) {
              return "vendor";
            }
            if (id.includes("firebase")) {
              return "firebase";
            }
            if (id.includes("chart.js") || id.includes("react-chartjs")) {
              return "charts";
            }
            if (id.includes("@google/genai")) {
              return "gemini";
            }
            if (id.includes("react-window")) {
              return "react-window";
            }
            if (id.includes("framer-motion")) {
              return "framer-motion";
            }
            if (id.includes("bcryptjs") || id.includes("validator") || id.includes("dompurify")) {
              return "utils-vendor";
            }
            return "vendor";
          }
          if (id.includes("/components/Dashboard")) {
            return "dashboard";
          }
          if (id.includes("/components/AdminPanel")) {
            return "admin";
          }
          if (id.includes("/components/NewCarsAdmin") || id.includes("/components/SellCarAdmin")) {
            return "admin-extended";
          }
          if (id.includes("/components/VehicleList") || id.includes("/components/VehicleDetail")) {
            return "vehicles";
          }
          if (id.includes("/components/Home")) {
            return "home";
          }
          if (id.includes("/components/Profile") || id.includes("/components/Login") || id.includes("/components/UnifiedLogin")) {
            return "auth";
          }
          if (id.includes("/components/ChatWidget") || id.includes("/components/CustomerInbox")) {
            return "chat";
          }
          if (id.includes("/components/SellCarPage") || id.includes("/components/NewCars")) {
            return "sell-car";
          }
          if (id.includes("/components/BuyerDashboard") || id.includes("/components/SellerProfilePage")) {
            return "user-pages";
          }
          if (id.includes("/components/Mobile")) {
            return "mobile-components";
          }
          if (id.includes("/components/AppProvider")) {
            return "app-provider";
          }
          if (id.includes("/constants/location")) {
            return "constants-location";
          }
          if (id.includes("/constants/fallback")) {
            return "constants-fallback";
          }
          if (id.includes("/constants/") || id.includes("/data/")) {
            return "constants";
          }
          if (id.includes("/services/vehicleService")) {
            return "service-vehicle";
          }
          if (id.includes("/services/userService")) {
            return "service-user";
          }
          if (id.includes("/services/geminiService")) {
            return "service-gemini";
          }
          if (id.includes("/services/")) {
            return "services";
          }
          if (id.includes("/utils/")) {
            return "utils";
          }
        },
        // Optimize chunk names for better caching - hash changes on every build
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]"
      }
    },
    // Use terser for better minification (smaller bundle size)
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug", "console.warn"],
        passes: 3,
        // Multiple passes for better compression
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
        hoist_vars: false,
        // Keep false to avoid issues
        keep_infinity: true
      },
      format: {
        comments: false,
        // Optimize output
        ecma: 2020,
        safari10: true
      },
      mangle: {
        safari10: true,
        properties: false
        // Keep properties unmangled for React components
      }
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: true,
    // Disable source maps for production (faster builds, smaller bundles)
    sourcemap: process.env.NODE_ENV === "development",
    // Better browser support - use modern ES for smaller bundles
    target: "es2020",
    // Enable asset inlining for small files (reduces HTTP requests)
    assetsInlineLimit: 8192,
    // Optimize for faster loading
    reportCompressedSize: false,
    // Improve build performance
    modulePreload: {
      polyfill: false
      // Modern browsers don't need polyfill
    },
    // Additional optimizations
    assetsDir: "assets",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    // FIXED: Changed from 5174 to standard Vite port 5173
    // Development server optimizations
    hmr: {
      overlay: true,
      // Improve WebSocket connection reliability
      protocol: "ws",
      host: "localhost",
      clientPort: 5173
      // Note: reconnect is handled automatically by Vite
      // WebSocket errors in console are harmless - they occur when HMR reconnects
    },
    // Enable file system caching for faster rebuilds
    fs: {
      cachedChecks: true,
      // Exclude API files from file system watching
      deny: ["**/api/**"]
    },
    // Optimize development server performance
    warmup: {
      clientFiles: ["./App.tsx", "./components/Header.tsx", "./components/Home.tsx"]
    },
    // Proxy API requests to development server (dev-api-server.js runs on port 3001)
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true,
        // CRITICAL FIX: Add timeout and better error handling
        timeout: 3e4,
        // 30 second timeout
        configure: (proxy, _options) => {
          proxy.on("error", (err, req, res) => {
            const errorInfo = {
              message: err.message,
              code: err.code,
              url: req.url,
              method: req.method
            };
            fetch("http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "vite.config.ts:277", message: "Vite proxy error", data: errorInfo, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "bug-4" }) }).catch(() => {
            });
            console.error("\u274C API Proxy Error:", err.message);
            console.error("   Request URL:", req.url);
            console.error("   Error Code:", err.code);
            console.warn("\u26A0\uFE0F Make sure the API server is running on port 3001: npm run dev:api");
            if (!res.headersSent) {
              res.writeHead(503, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              });
              res.end(JSON.stringify({
                success: false,
                error: "Service Unavailable",
                reason: "API server is not running. Please start it with: npm run dev:api",
                message: err.message
              }));
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            if (process.env.NODE_ENV === "development") {
              console.log("\u2192 API Request:", req.method, req.url);
            }
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            if (process.env.NODE_ENV === "development") {
              console.log("\u2190 API Response:", proxyRes.statusCode, req.url);
            }
          });
          proxy.on("close", (res, socket, head) => {
            fetch("http://127.0.0.1:7242/ingest/5b6f90c8-812c-4202-acd3-f36cea066e0b", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "vite.config.ts:304", message: "Vite proxy connection closed", data: { hasRes: !!res }, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "bug-4" }) }).catch(() => {
            });
            if (process.env.NODE_ENV === "development") {
              console.warn("\u26A0\uFE0F Proxy connection closed");
            }
          });
        }
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ["react", "react-dom", "framer-motion", "socket.io-client"],
    // Exclude heavy dependencies from pre-bundling
    exclude: ["@google/genai", "mongodb", "mongoose"],
    // Force optimization of specific packages
    esbuildOptions: {
      target: "es2020"
    }
  },
  // Enable esbuild optimizations in dev mode
  esbuild: {
    logOverride: { "this-is-undefined-in-esm": "silent" }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxiaGFkclxcXFxEb3dubG9hZHNcXFxccmVyaWRlICgyKVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcYmhhZHJcXFxcRG93bmxvYWRzXFxcXHJlcmlkZSAoMilcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2JoYWRyL0Rvd25sb2Fkcy9yZXJpZGUlMjAoMikvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KClcbiAgICAvLyBQV0EgcGx1Z2luIGRpc2FibGVkIHRvIHByZXZlbnQgc2VydmljZSB3b3JrZXIgY2FjaGluZyBpc3N1ZXNcbiAgXSxcbiAgLy8gRXhjbHVkZSBBUEkgZmlsZXMgYW5kIHNlcnZlci1zaWRlIGRlcGVuZGVuY2llcyBmcm9tIGNsaWVudCBidW5kbGluZ1xuICBkZWZpbmU6IHtcbiAgICAvLyBQcmV2ZW50IHNlcnZlci1zaWRlIGNvZGUgZnJvbSBiZWluZyBidW5kbGVkIGluIGNsaWVudFxuICAgICdwcm9jZXNzLmVudi5OT0RFX0VOVic6IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52Lk5PREVfRU5WIHx8ICdkZXZlbG9wbWVudCcpLFxuICAgIC8vIHByb2Nlc3MuZW1pdFdhcm5pbmcgaXMgcG9seWZpbGxlZCBpbiBpbmRleC5odG1sLCBubyBuZWVkIHRvIGRlZmluZSBpdCBoZXJlXG4gICAgZ2xvYmFsOiAnZ2xvYmFsVGhpcydcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBPcHRpbWl6ZSBjaHVuayBzaXplIC0gaW5jcmVhc2VkIHRocmVzaG9sZCBzaW5jZSB3ZSdyZSBzcGxpdHRpbmcgYmV0dGVyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA2MDAsXG4gICAgLy8gRW5zdXJlIHByb3BlciBtb2R1bGUgcmVzb2x1dGlvbiBhbmQgY2h1bmsgb3JkZXJpbmdcbiAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgIGluY2x1ZGU6IFsvbm9kZV9tb2R1bGVzL10sXG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZVxuICAgIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgLy8gRXhjbHVkZSBBUEkgZmlsZXMgZnJvbSBjbGllbnQgYnVpbGRcbiAgICAgIGV4dGVybmFsOiAoaWQpID0+IHtcbiAgICAgICAgLy8gTW9yZSBwZXJmb3JtYW50IGFuZCBzcGVjaWZpYyBjaGVjayBmb3IgQVBJIGZpbGVzXG4gICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgXG4gICAgICAgIC8vIEV4Y2x1ZGUgYWxsIEFQSSByb3V0ZXNcbiAgICAgICAgaWYgKGlkLnN0YXJ0c1dpdGgoJy9hcGkvJykgfHwgaWQuaW5jbHVkZXMoJy9hcGkvJykpIHtcbiAgICAgICAgICByZXR1cm4gaWQuZW5kc1dpdGgoJy50cycpIHx8IGlkLmVuZHNXaXRoKCcuanMnKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRXhjbHVkZSBzZXJ2ZXItb25seSBGaXJlYmFzZSBBZG1pbiBmaWxlcyBmcm9tIGNsaWVudCBidW5kbGVcbiAgICAgICAgLy8gQ2hlY2sgZm9yIGJvdGggZm9yd2FyZCBhbmQgYmFja3NsYXNoIHBhdGhzIChXaW5kb3dzL1VuaXggY29tcGF0aWJpbGl0eSlcbiAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvbGliL2ZpcmViYXNlLWFkbWluJykgfHwgaWQuaW5jbHVkZXMoJ1xcXFxsaWJcXFxcZmlyZWJhc2UtYWRtaW4nKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJy9zZXJ2ZXIvZmlyZWJhc2UtYWRtaW4nKSB8fCBpZC5pbmNsdWRlcygnXFxcXHNlcnZlclxcXFxmaXJlYmFzZS1hZG1pbicpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcygnL3NlcnZlci8nKSB8fCBpZC5pbmNsdWRlcygnXFxcXHNlcnZlclxcXFwnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ2ZpcmViYXNlLWFkbWluLWRiJykgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdmaXJlYmFzZS1hZG1pbi1kYi5qcycpIHx8XG4gICAgICAgICAgICBpZC5pbmNsdWRlcygnZmlyZWJhc2UtYWRtaW4tZGIudHMnKSkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBFeGNsdWRlIHNlcnZlci1zaWRlIHNlcnZpY2UgZmlsZXMgdGhhdCBpbXBvcnQgZmlyZWJhc2UtYWRtaW4tZGJcbiAgICAgICAgLy8gVGhlc2Ugc2hvdWxkIG9ubHkgYmUgdXNlZCBpbiBBUEkgcm91dGVzLCBub3QgaW4gY2xpZW50IGNvZGVcbiAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvc2VydmljZXMvZmlyZWJhc2UtdXNlci1zZXJ2aWNlJykgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvc2VydmljZXMvZmlyZWJhc2UtdmVoaWNsZS1zZXJ2aWNlJykgfHxcbiAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvc2VydmljZXMvZmlyZWJhc2UtY29udmVyc2F0aW9uLXNlcnZpY2UnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ1xcXFxzZXJ2aWNlc1xcXFxmaXJlYmFzZS11c2VyLXNlcnZpY2UnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ1xcXFxzZXJ2aWNlc1xcXFxmaXJlYmFzZS12ZWhpY2xlLXNlcnZpY2UnKSB8fFxuICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ1xcXFxzZXJ2aWNlc1xcXFxmaXJlYmFzZS1jb252ZXJzYXRpb24tc2VydmljZScpKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEV4Y2x1ZGUgbW9kZWxzIGRpcmVjdG9yeSBmcm9tIGNsaWVudCBidW5kbGUgKHNlcnZlci1zaWRlIG9ubHkpXG4gICAgICAgIGlmIChpZC5pbmNsdWRlcygnL21vZGVscy8nKSAmJiAoaWQuZW5kc1dpdGgoJy50cycpIHx8IGlkLmVuZHNXaXRoKCcuanMnKSkpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIE1vcmUgYWdncmVzc2l2ZSBjb2RlIHNwbGl0dGluZyBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlXG4gICAgICAgIG1hbnVhbENodW5rczogKGlkKSA9PiB7XG4gICAgICAgICAgLy8gRklYOiBSZWFjdCBtdXN0IGJlIGluIHRoZSB2ZW5kb3IgY2h1bmsgc28gb3RoZXIgbGlicmFyaWVzIChsaWtlIGZyYW1lci1tb3Rpb24pIFxuICAgICAgICAgIC8vIHRoYXQgZGVwZW5kIG9uIGl0IGNhbiBhY2Nlc3MgUmVhY3QuY3JlYXRlQ29udGV4dCB3aGVuIHRoZXkgbG9hZFxuICAgICAgICAgIC8vIENoZWNrIGZvciBSZWFjdC1yZWxhdGVkIG1vZHVsZXMgZmlyc3QsIGJlZm9yZSBhbnkgb3RoZXIgbm9kZV9tb2R1bGVzIGNoZWNrc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBSZWFjdCBmaXJzdCAtIHB1dCBpbiB2ZW5kb3IgY2h1bmsgc28gZGVwZW5kZW50IGxpYnJhcmllcyBjYW4gYWNjZXNzIGl0XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9yZWFjdC8nKSB8fCBcbiAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3JlYWN0LWRvbS8nKSB8fFxuICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCcvcmVhY3RcXFxcJykgfHxcbiAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnL3JlYWN0LWRvbVxcXFwnKSB8fFxuICAgICAgICAgICAgICAgIGlkLmluY2x1ZGVzKCdyZWFjdC9pbmRleCcpIHx8XG4gICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ3JlYWN0LWRvbS9pbmRleCcpIHx8XG4gICAgICAgICAgICAgICAgaWQuaW5jbHVkZXMoJ3JlYWN0L2pzeC1ydW50aW1lJykgfHxcbiAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygncmVhY3QvanN4LWRldi1ydW50aW1lJykgfHxcbiAgICAgICAgICAgICAgICBpZC5pbmNsdWRlcygnc2NoZWR1bGVyJykpIHtcbiAgICAgICAgICAgICAgLy8gUmV0dXJuICd2ZW5kb3InIHRvIGVuc3VyZSBSZWFjdCBpcyBidW5kbGVkIHdpdGggbGlicmFyaWVzIHRoYXQgZGVwZW5kIG9uIGl0XG4gICAgICAgICAgICAgIC8vIFRoaXMgcHJldmVudHMgXCJjcmVhdGVDb250ZXh0IGlzIHVuZGVmaW5lZFwiIGVycm9ycyBpbiBzcGxpdCBjaHVua3NcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3InO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBTZXBhcmF0ZSBoZWF2eSBsaWJyYXJpZXMgaW50byB0aGVpciBvd24gY2h1bmtzIGZvciBiZXR0ZXIgY2FjaGluZ1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdmaXJlYmFzZScpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAnZmlyZWJhc2UnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdjaGFydC5qcycpIHx8IGlkLmluY2x1ZGVzKCdyZWFjdC1jaGFydGpzJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdjaGFydHMnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAZ29vZ2xlL2dlbmFpJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICdnZW1pbmknO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdC13aW5kb3cnKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ3JlYWN0LXdpbmRvdyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTcGxpdCBmcmFtZXItbW90aW9uIGludG8gaXRzIG93biBjaHVuayAobGFyZ2UgYW5pbWF0aW9uIGxpYnJhcnkpXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2ZyYW1lci1tb3Rpb24nKSkge1xuICAgICAgICAgICAgICByZXR1cm4gJ2ZyYW1lci1tb3Rpb24nO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gR3JvdXAgc21hbGxlciB1dGlsaXR5IGxpYnJhcmllcyB0b2dldGhlclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdiY3J5cHRqcycpIHx8IGlkLmluY2x1ZGVzKCd2YWxpZGF0b3InKSB8fCBpZC5pbmNsdWRlcygnZG9tcHVyaWZ5JykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd1dGlscy12ZW5kb3InO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gQWxsIG90aGVyIG5vZGVfbW9kdWxlcyBnbyB0byB2ZW5kb3IgY2h1bmtcbiAgICAgICAgICAgIHJldHVybiAndmVuZG9yJztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU3BsaXQgYnkgZmVhdHVyZS9yb3V0ZSBmb3IgYmV0dGVyIGNhY2hpbmcgYW5kIGxhenkgbG9hZGluZ1xuICAgICAgICAgIC8vIE1vcmUgZ3JhbnVsYXIgc3BsaXR0aW5nIHRvIHJlZHVjZSBpbmRpdmlkdWFsIGNodW5rIHNpemVzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9EYXNoYm9hcmQnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdkYXNoYm9hcmQnO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTcGxpdCBhZG1pbiBwYW5lbCBpbnRvIHNtYWxsZXIgY2h1bmtzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9BZG1pblBhbmVsJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnYWRtaW4nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9jb21wb25lbnRzL05ld0NhcnNBZG1pbicpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9TZWxsQ2FyQWRtaW4nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhZG1pbi1leHRlbmRlZCc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvVmVoaWNsZUxpc3QnKSB8fCBpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvVmVoaWNsZURldGFpbCcpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3ZlaGljbGVzJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9Ib21lJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnaG9tZSc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvUHJvZmlsZScpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9Mb2dpbicpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9VbmlmaWVkTG9naW4nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhdXRoJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9DaGF0V2lkZ2V0JykgfHwgaWQuaW5jbHVkZXMoJy9jb21wb25lbnRzL0N1c3RvbWVySW5ib3gnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdjaGF0JztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BsaXQgbGFyZ2UgY29tcG9uZW50cyBpbnRvIHNlcGFyYXRlIGNodW5rc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvU2VsbENhclBhZ2UnKSB8fCBpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvTmV3Q2FycycpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3NlbGwtY2FyJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9CdXllckRhc2hib2FyZCcpIHx8IGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9TZWxsZXJQcm9maWxlUGFnZScpKSB7XG4gICAgICAgICAgICByZXR1cm4gJ3VzZXItcGFnZXMnO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBTcGxpdCBtb2JpbGUgY29tcG9uZW50cyBpbnRvIHNlcGFyYXRlIGNodW5rIChsYXJnZSBidW5kbGUpXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvY29tcG9uZW50cy9Nb2JpbGUnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdtb2JpbGUtY29tcG9uZW50cyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFNwbGl0IEFwcFByb3ZpZGVyIChsYXJnZSBjb250ZXh0IHByb3ZpZGVyKVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2NvbXBvbmVudHMvQXBwUHJvdmlkZXInKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhcHAtcHJvdmlkZXInO1xuICAgICAgICAgIH1cbiAgICAgICAgICBcbiAgICAgICAgICAvLyBTcGxpdCBjb25zdGFudHMgYnkgdHlwZSBmb3IgYmV0dGVyIGxhenkgbG9hZGluZ1xuICAgICAgICAgIC8vIE9ubHkgc3BsaXQgaWYgdGhlIG1vZHVsZSBpcyBhY3R1YWxseSBpbXBvcnRlZCAobm90IGp1c3QgcmVmZXJlbmNlZClcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9jb25zdGFudHMvbG9jYXRpb24nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdjb25zdGFudHMtbG9jYXRpb24nO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBQbGFucyBhbmQgYm9vc3QgYXJlIGR5bmFtaWNhbGx5IGltcG9ydGVkLCBzbyBkb24ndCBjcmVhdGUgc2VwYXJhdGUgY2h1bmtzXG4gICAgICAgICAgLy8gVGhleSdsbCBiZSBpbmNsdWRlZCBpbiB0aGUgY2h1bmtzIHRoYXQgYWN0dWFsbHkgdXNlIHRoZW1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9jb25zdGFudHMvZmFsbGJhY2snKSkge1xuICAgICAgICAgICAgcmV0dXJuICdjb25zdGFudHMtZmFsbGJhY2snO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBHcm91cCBhbGwgb3RoZXIgY29uc3RhbnRzIHRvZ2V0aGVyIHRvIGF2b2lkIGVtcHR5IGNodW5rc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL2NvbnN0YW50cy8nKSB8fCBpZC5pbmNsdWRlcygnL2RhdGEvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnY29uc3RhbnRzJztcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gU3BsaXQgc2VydmljZXMgYnkgZnVuY3Rpb25hbGl0eVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnL3NlcnZpY2VzL3ZlaGljbGVTZXJ2aWNlJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnc2VydmljZS12ZWhpY2xlJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvc2VydmljZXMvdXNlclNlcnZpY2UnKSkge1xuICAgICAgICAgICAgcmV0dXJuICdzZXJ2aWNlLXVzZXInO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zZXJ2aWNlcy9nZW1pbmlTZXJ2aWNlJykpIHtcbiAgICAgICAgICAgIHJldHVybiAnc2VydmljZS1nZW1pbmknO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJy9zZXJ2aWNlcy8nKSkge1xuICAgICAgICAgICAgcmV0dXJuICdzZXJ2aWNlcyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIC8vIFNwbGl0IHV0aWxzXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCcvdXRpbHMvJykpIHtcbiAgICAgICAgICAgIHJldHVybiAndXRpbHMnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgLy8gT3B0aW1pemUgY2h1bmsgbmFtZXMgZm9yIGJldHRlciBjYWNoaW5nIC0gaGFzaCBjaGFuZ2VzIG9uIGV2ZXJ5IGJ1aWxkXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5bZXh0XSdcbiAgICAgIH1cbiAgICB9LFxuICAgIC8vIFVzZSB0ZXJzZXIgZm9yIGJldHRlciBtaW5pZmljYXRpb24gKHNtYWxsZXIgYnVuZGxlIHNpemUpXG4gICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICBjb21wcmVzczoge1xuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXG4gICAgICAgIHB1cmVfZnVuY3M6IFsnY29uc29sZS5sb2cnLCAnY29uc29sZS5pbmZvJywgJ2NvbnNvbGUuZGVidWcnLCAnY29uc29sZS53YXJuJ10sXG4gICAgICAgIHBhc3NlczogMywgLy8gTXVsdGlwbGUgcGFzc2VzIGZvciBiZXR0ZXIgY29tcHJlc3Npb25cbiAgICAgICAgZGVhZF9jb2RlOiB0cnVlLFxuICAgICAgICB1bnVzZWQ6IHRydWUsXG4gICAgICAgIGNvbGxhcHNlX3ZhcnM6IHRydWUsXG4gICAgICAgIHJlZHVjZV92YXJzOiB0cnVlLFxuICAgICAgICAvLyBBZGRpdGlvbmFsIGFnZ3Jlc3NpdmUgb3B0aW1pemF0aW9uc1xuICAgICAgICBhcnJvd3M6IHRydWUsXG4gICAgICAgIGFyZ3VtZW50czogdHJ1ZSxcbiAgICAgICAgYm9vbGVhbnM6IHRydWUsXG4gICAgICAgIGlmX3JldHVybjogdHJ1ZSxcbiAgICAgICAgam9pbl92YXJzOiB0cnVlLFxuICAgICAgICBsb29wczogdHJ1ZSxcbiAgICAgICAgc2VxdWVuY2VzOiB0cnVlLFxuICAgICAgICBwcm9wZXJ0aWVzOiB0cnVlLFxuICAgICAgICBjb21wdXRlZF9wcm9wczogdHJ1ZSxcbiAgICAgICAgaG9pc3RfZnVuczogdHJ1ZSxcbiAgICAgICAgaG9pc3RfdmFyczogZmFsc2UsIC8vIEtlZXAgZmFsc2UgdG8gYXZvaWQgaXNzdWVzXG4gICAgICAgIGtlZXBfaW5maW5pdHk6IHRydWUsXG4gICAgICB9LFxuICAgICAgZm9ybWF0OiB7XG4gICAgICAgIGNvbW1lbnRzOiBmYWxzZSxcbiAgICAgICAgLy8gT3B0aW1pemUgb3V0cHV0XG4gICAgICAgIGVjbWE6IDIwMjAsXG4gICAgICAgIHNhZmFyaTEwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG1hbmdsZToge1xuICAgICAgICBzYWZhcmkxMDogdHJ1ZSxcbiAgICAgICAgcHJvcGVydGllczogZmFsc2UsIC8vIEtlZXAgcHJvcGVydGllcyB1bm1hbmdsZWQgZm9yIFJlYWN0IGNvbXBvbmVudHNcbiAgICAgIH0sXG4gICAgfSxcbiAgICAvLyBPcHRpbWl6ZSBDU1NcbiAgICBjc3NNaW5pZnk6IHRydWUsXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgIC8vIERpc2FibGUgc291cmNlIG1hcHMgZm9yIHByb2R1Y3Rpb24gKGZhc3RlciBidWlsZHMsIHNtYWxsZXIgYnVuZGxlcylcbiAgICBzb3VyY2VtYXA6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAnZGV2ZWxvcG1lbnQnLFxuICAgIC8vIEJldHRlciBicm93c2VyIHN1cHBvcnQgLSB1c2UgbW9kZXJuIEVTIGZvciBzbWFsbGVyIGJ1bmRsZXNcbiAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgIC8vIEVuYWJsZSBhc3NldCBpbmxpbmluZyBmb3Igc21hbGwgZmlsZXMgKHJlZHVjZXMgSFRUUCByZXF1ZXN0cylcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogODE5MixcbiAgICAvLyBPcHRpbWl6ZSBmb3IgZmFzdGVyIGxvYWRpbmdcbiAgICByZXBvcnRDb21wcmVzc2VkU2l6ZTogZmFsc2UsXG4gICAgLy8gSW1wcm92ZSBidWlsZCBwZXJmb3JtYW5jZVxuICAgIG1vZHVsZVByZWxvYWQ6IHtcbiAgICAgIHBvbHlmaWxsOiBmYWxzZSwgLy8gTW9kZXJuIGJyb3dzZXJzIGRvbid0IG5lZWQgcG9seWZpbGxcbiAgICB9LFxuICAgIC8vIEFkZGl0aW9uYWwgb3B0aW1pemF0aW9uc1xuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsICAvLyBGSVhFRDogQ2hhbmdlZCBmcm9tIDUxNzQgdG8gc3RhbmRhcmQgVml0ZSBwb3J0IDUxNzNcbiAgICAvLyBEZXZlbG9wbWVudCBzZXJ2ZXIgb3B0aW1pemF0aW9uc1xuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogdHJ1ZSxcbiAgICAgIC8vIEltcHJvdmUgV2ViU29ja2V0IGNvbm5lY3Rpb24gcmVsaWFiaWxpdHlcbiAgICAgIHByb3RvY29sOiAnd3MnLFxuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICBjbGllbnRQb3J0OiA1MTczXG4gICAgICAvLyBOb3RlOiByZWNvbm5lY3QgaXMgaGFuZGxlZCBhdXRvbWF0aWNhbGx5IGJ5IFZpdGVcbiAgICAgIC8vIFdlYlNvY2tldCBlcnJvcnMgaW4gY29uc29sZSBhcmUgaGFybWxlc3MgLSB0aGV5IG9jY3VyIHdoZW4gSE1SIHJlY29ubmVjdHNcbiAgICB9LFxuICAgIC8vIEVuYWJsZSBmaWxlIHN5c3RlbSBjYWNoaW5nIGZvciBmYXN0ZXIgcmVidWlsZHNcbiAgICBmczoge1xuICAgICAgY2FjaGVkQ2hlY2tzOiB0cnVlLFxuICAgICAgLy8gRXhjbHVkZSBBUEkgZmlsZXMgZnJvbSBmaWxlIHN5c3RlbSB3YXRjaGluZ1xuICAgICAgZGVueTogWycqKi9hcGkvKionXVxuICAgIH0sXG4gICAgLy8gT3B0aW1pemUgZGV2ZWxvcG1lbnQgc2VydmVyIHBlcmZvcm1hbmNlXG4gICAgd2FybXVwOiB7XG4gICAgICBjbGllbnRGaWxlczogWycuL0FwcC50c3gnLCAnLi9jb21wb25lbnRzL0hlYWRlci50c3gnLCAnLi9jb21wb25lbnRzL0hvbWUudHN4J11cbiAgICB9LFxuICAgIC8vIFByb3h5IEFQSSByZXF1ZXN0cyB0byBkZXZlbG9wbWVudCBzZXJ2ZXIgKGRldi1hcGktc2VydmVyLmpzIHJ1bnMgb24gcG9ydCAzMDAxKVxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgLy8gQ1JJVElDQUwgRklYOiBBZGQgdGltZW91dCBhbmQgYmV0dGVyIGVycm9yIGhhbmRsaW5nXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAwLCAvLyAzMCBzZWNvbmQgdGltZW91dFxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCByZXEsIHJlcykgPT4ge1xuICAgICAgICAgICAgLy8gI3JlZ2lvbiBhZ2VudCBsb2dcbiAgICAgICAgICAgIGNvbnN0IGVycm9ySW5mbyA9IHtcbiAgICAgICAgICAgICAgbWVzc2FnZTogZXJyLm1lc3NhZ2UsXG4gICAgICAgICAgICAgIGNvZGU6IChlcnIgYXMgYW55KS5jb2RlLFxuICAgICAgICAgICAgICB1cmw6IHJlcS51cmwsXG4gICAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGZldGNoKCdodHRwOi8vMTI3LjAuMC4xOjcyNDIvaW5nZXN0LzViNmY5MGM4LTgxMmMtNDIwMi1hY2QzLWYzNmNlYTA2NmUwYicse21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHtsb2NhdGlvbjondml0ZS5jb25maWcudHM6Mjc3JyxtZXNzYWdlOidWaXRlIHByb3h5IGVycm9yJyxkYXRhOmVycm9ySW5mbyx0aW1lc3RhbXA6RGF0ZS5ub3coKSxzZXNzaW9uSWQ6J2RlYnVnLXNlc3Npb24nLHJ1bklkOidydW4xJyxoeXBvdGhlc2lzSWQ6J2J1Zy00J30pfSkuY2F0Y2goKCk9Pnt9KTtcbiAgICAgICAgICAgIC8vICNlbmRyZWdpb25cbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1x1Mjc0QyBBUEkgUHJveHkgRXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignICAgUmVxdWVzdCBVUkw6JywgcmVxLnVybCk7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCcgICBFcnJvciBDb2RlOicsIChlcnIgYXMgYW55KS5jb2RlKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignXHUyNkEwXHVGRTBGIE1ha2Ugc3VyZSB0aGUgQVBJIHNlcnZlciBpcyBydW5uaW5nIG9uIHBvcnQgMzAwMTogbnBtIHJ1biBkZXY6YXBpJyk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIENSSVRJQ0FMIEZJWDogU2VuZCBwcm9wZXIgZXJyb3IgcmVzcG9uc2UgaW5zdGVhZCBvZiBoYW5naW5nXG4gICAgICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMywge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJ1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdTZXJ2aWNlIFVuYXZhaWxhYmxlJyxcbiAgICAgICAgICAgICAgICByZWFzb246ICdBUEkgc2VydmVyIGlzIG5vdCBydW5uaW5nLiBQbGVhc2Ugc3RhcnQgaXQgd2l0aDogbnBtIHJ1biBkZXY6YXBpJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlcnIubWVzc2FnZVxuICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnXHUyMTkyIEFQSSBSZXF1ZXN0OicsIHJlcS5tZXRob2QsIHJlcS51cmwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcycsIChwcm94eVJlcywgcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1x1MjE5MCBBUEkgUmVzcG9uc2U6JywgcHJveHlSZXMuc3RhdHVzQ29kZSwgcmVxLnVybCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gQ1JJVElDQUwgRklYOiBIYW5kbGUgY29ubmVjdGlvbiBpc3N1ZXNcbiAgICAgICAgICBwcm94eS5vbignY2xvc2UnLCAocmVzLCBzb2NrZXQsIGhlYWQpID0+IHtcbiAgICAgICAgICAgIC8vICNyZWdpb24gYWdlbnQgbG9nXG4gICAgICAgICAgICBmZXRjaCgnaHR0cDovLzEyNy4wLjAuMTo3MjQyL2luZ2VzdC81YjZmOTBjOC04MTJjLTQyMDItYWNkMy1mMzZjZWEwNjZlMGInLHttZXRob2Q6J1BPU1QnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sYm9keTpKU09OLnN0cmluZ2lmeSh7bG9jYXRpb246J3ZpdGUuY29uZmlnLnRzOjMwNCcsbWVzc2FnZTonVml0ZSBwcm94eSBjb25uZWN0aW9uIGNsb3NlZCcsZGF0YTp7aGFzUmVzOiEhcmVzfSx0aW1lc3RhbXA6RGF0ZS5ub3coKSxzZXNzaW9uSWQ6J2RlYnVnLXNlc3Npb24nLHJ1bklkOidydW4xJyxoeXBvdGhlc2lzSWQ6J2J1Zy00J30pfSkuY2F0Y2goKCk9Pnt9KTtcbiAgICAgICAgICAgIC8vICNlbmRyZWdpb25cbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1x1MjZBMFx1RkUwRiBQcm94eSBjb25uZWN0aW9uIGNsb3NlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgLy8gT3B0aW1pemUgZGVwZW5kZW5jaWVzXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ2ZyYW1lci1tb3Rpb24nLCAnc29ja2V0LmlvLWNsaWVudCddLFxuICAgIC8vIEV4Y2x1ZGUgaGVhdnkgZGVwZW5kZW5jaWVzIGZyb20gcHJlLWJ1bmRsaW5nXG4gICAgZXhjbHVkZTogWydAZ29vZ2xlL2dlbmFpJywgJ21vbmdvZGInLCAnbW9uZ29vc2UnXSxcbiAgICAvLyBGb3JjZSBvcHRpbWl6YXRpb24gb2Ygc3BlY2lmaWMgcGFja2FnZXNcbiAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICB9LFxuICB9LFxuICAvLyBFbmFibGUgZXNidWlsZCBvcHRpbWl6YXRpb25zIGluIGRldiBtb2RlXG4gIGVzYnVpbGQ6IHtcbiAgICBsb2dPdmVycmlkZTogeyAndGhpcy1pcy11bmRlZmluZWQtaW4tZXNtJzogJ3NpbGVudCcgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UyxTQUFTLG9CQUFvQjtBQUNwVSxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBO0FBQUEsRUFFUjtBQUFBO0FBQUEsRUFFQSxRQUFRO0FBQUE7QUFBQSxJQUVOLHdCQUF3QixLQUFLLFVBQVUsUUFBUSxJQUFJLFlBQVksYUFBYTtBQUFBO0FBQUEsSUFFNUUsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsdUJBQXVCO0FBQUE7QUFBQSxJQUV2QixpQkFBaUI7QUFBQSxNQUNmLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIseUJBQXlCO0FBQUEsSUFDM0I7QUFBQSxJQUNBLGVBQWU7QUFBQTtBQUFBLE1BRWIsVUFBVSxDQUFDLE9BQU87QUFFaEIsWUFBSSxHQUFHLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFHeEMsWUFBSSxHQUFHLFdBQVcsT0FBTyxLQUFLLEdBQUcsU0FBUyxPQUFPLEdBQUc7QUFDbEQsaUJB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
