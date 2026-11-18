import { defineConfig } from 'vite';

/** Adresse du site (aperçus de partage, Google) : SITE_URL=https://votre-domaine npm run build */
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');

export default defineConfig({
  plugins: [{ name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL) }],
  base: './',
  // MapLibre charge son « worker » à côté de son module : pas de pré-bundle Vite
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'iife' },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
