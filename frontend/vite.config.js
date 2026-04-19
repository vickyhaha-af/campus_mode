import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // bind to 0.0.0.0 (all interfaces)
    port: 5180,        // moved from 5173 to avoid clash with another local project
    strictPort: true,  // if 5180 busy, fail loudly rather than silently pick another
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
