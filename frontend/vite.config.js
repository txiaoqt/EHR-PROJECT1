import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  root: '',

  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:4000', // your backend CAPTCHA server
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    outDir: 'dist'
  }
})
