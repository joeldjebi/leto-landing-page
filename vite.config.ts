import { defineConfig } from 'vite';

/** Adresse du site (aperçus de partage, Google) : SITE_URL=https://votre-domaine npm run build */
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/$/, '');
/** Back-office (les anciens liens #/… y sont renvoyés) */
// Liens de suivi (#/suivi/…) et anciens liens : vers l'application web publique (/pro), jamais vers l'administration
const BO_URL = (process.env.BO_URL ?? 'https://vite.ci/pro').replace(/\/$/, '');

export default defineConfig({
  plugins: [{ name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL).replaceAll('%BO_URL%', BO_URL) }],
  base: './',
  // MapLibre charge son « worker » à côté de son module : pas de pré-bundle Vite
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'iife' },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
