import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    https: {}, // Força o uso de HTTPS (necessário para câmera no celular)
    host: true, // Permite acesso via IP na rede local
    proxy: {
      '/api-tasks': {
        target: 'https://n8n-n8n.sd8jyi.easypanel.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-tasks/, '')
      },
      '/api-v4-strategy': {
        target: 'https://n8n-n8n.sd8jyi.easypanel.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-v4-strategy/, '')
      },
      '/api-contas': {
        target: 'https://n8n-n8n.sd8jyi.easypanel.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-contas/, '')
      }
    }
  }
})
