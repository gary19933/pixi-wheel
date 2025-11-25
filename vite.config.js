import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    host: true, // Allow external connections
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.io'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    // Inject environment variables at build time
    'import.meta.env.VITE_API_GATEWAY': JSON.stringify(process.env.VITE_API_GATEWAY || 'http://localhost:3000'),
    'import.meta.env.VITE_USE_MICROSERVICE_FOR_SPIN': JSON.stringify(process.env.VITE_USE_MICROSERVICE_FOR_SPIN || 'false')
  }
});

