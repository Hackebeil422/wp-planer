import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/wp-planer/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WP & Haustechnik Planer',
        short_name: 'WP-Planer',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0284c7',
      }
    })
  ],
})