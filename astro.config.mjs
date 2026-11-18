// Configuration Astro — site 100 % statique, déployé sur Netlify.
import { defineConfig } from 'astro/config';

export default defineConfig({
  // URL provisoire, à remplacer par le domaine définitif.
  site: 'https://brasserie-maelstrom.netlify.app',
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
