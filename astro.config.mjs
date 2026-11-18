// Configuration Astro — site 100 % statique.
// Publication : GitHub Pages (sous-dossier /brasserie-maelstrom/, via le workflow
// .github/workflows/deploy-pages.yml) ou Netlify (racine, via netlify.toml).
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Fournis par le workflow GitHub Pages ; valeurs par défaut pour Netlify et le local.
  site: process.env.SITE_URL || 'https://brasserie-maelstrom.netlify.app',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  vite: {
    build: {
      // Aucun script inline : la CSP (netlify.toml) n'autorise que script-src 'self'.
      assetsInlineLimit: 0,
      // Three.js (≈ 140 Ko gzip) est chargé à part, après le premier affichage.
      chunkSizeWarningLimit: 650,
    },
  },
});
