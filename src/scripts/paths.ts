// Chemins compatibles avec un site servi dans un sous-dossier
// (GitHub Pages : /brasserie-maelstrom/) comme à la racine (Netlify, local).

/** Préfixe un chemin absolu du site par le `base` d'Astro. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}
