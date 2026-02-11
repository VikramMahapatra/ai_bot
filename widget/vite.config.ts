import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // allows external access
    port: 5173, // your local dev port
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'thomasina-mesogleal-alarmingly.ngrok-free.dev' // <-- add your ngrok host here
    ]
  },
  build: {
    lib: {
      entry: './src/index.tsx',
      name: 'AIChatbotWidget',
      fileName: 'chatbot-widget',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        assetFileNames: 'chatbot-widget.[ext]'
      }
    }
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})
