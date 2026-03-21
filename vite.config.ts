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
  }
})
