import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true expõe o servidor de dev na rede local, então você consegue
// abrir http://SEU-IP:5173 no celular para testar o PWA direto no aparelho.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  }
})
