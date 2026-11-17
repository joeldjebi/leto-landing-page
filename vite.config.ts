import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // MapLibre charge son « worker » à côté de son module : pas de pré-bundle Vite
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'iife' },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
