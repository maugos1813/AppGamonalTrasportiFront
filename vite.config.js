import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Recharts y @react-google-maps/api solo se importan detras de un lazy() (para
    // que el build de produccion no los cargue en cada pagina - ver manualChunks
    // mas abajo). Como consecuencia, el scanner de arranque de Vite no los ve, asi
    // que sin esto la primera vez que se entra a Inicio (dueno) o al Mapa en
    // desarrollo, Vite las descubre recien ahi, las pre-empaqueta de cero y fuerza
    // un reload completo de la pagina - el "tranco" al entrar a esas pantallas.
    // Con esto quedan pre-empaquetadas desde que arranca el server.
    include: ['recharts', '@react-google-maps/api'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Only group packages that are shared by several lazy-loaded pages (so
          // splitting avoids duplicating their code across chunks). Google Maps
          // has a single consumer (MapPage), so the default per-route chunk
          // already isolates it with no need - and forcing it into its own named
          // chunk previously welded an unrelated shared runtime helper into it,
          // which every page ended up importing.
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'axios'
          if (
            /[\\/]node_modules[\\/]react-router(-dom)?[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]react[\\/]/.test(id) ||
            /[\\/]node_modules[\\/]react-dom[\\/]/.test(id)
          ) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
