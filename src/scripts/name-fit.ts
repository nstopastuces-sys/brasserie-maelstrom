// Mise en page du nom géant derrière la bouteille.
// Les noms vont de 9 à 22 caractères : on choisit le découpage en lignes
// (1 à 3) qui donne la plus grande taille de police possible dans le hero.

export interface NameLayout {
  lines: string[];
  /** Taille de police en px pour la zone donnée. */
  size: number;
}

/** Largeur approximative des capitales Anton, en em (rendu serveur, sans mesure). */
const ANTON_WIDTH: Record<string, number> = {
  ' ': 0.22, I: 0.24, J: 0.36, M: 0.6, W: 0.66, A: 0.47, O: 0.47, Q: 0.47, G: 0.46,
};
export function approxWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ANTON_WIDTH[ch] ?? 0.44;
  return w;
}

/** Toutes les façons de découper `words` en `n` lignes contiguës. */
function splits(words: string[], n: number): string[][] {
  if (n === 1) return [[words.join(' ')]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) {
    for (const rest of splits(words.slice(i), n - 1)) {
      out.push([words.slice(0, i).join(' '), ...rest]);
    }
  }
  return out;
}

/**
 * @param name   nom de la bière
 * @param width  largeur disponible (px)
 * @param height hauteur disponible (px)
 * @param measure largeur d'un texte en em (mesure réelle côté client)
 * @param maxRatio taille maximale en fraction de la largeur (22vw sur ordinateur)
 */
export function layoutName(
  name: string,
  width: number,
  height: number,
  measure: (t: string) => number = approxWidth,
  maxRatio = 0.22,
): NameLayout {
  const words = name.toUpperCase().split(/\s+/);
  const maxSize = width * maxRatio; // ≈ 22vw sur ordinateur, plafond de la charte
  const lineHeight = 0.86;
  let best: NameLayout = { lines: [name.toUpperCase()], size: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    for (const lines of splits(words, n)) {
      const widest = Math.max(...lines.map(measure));
      const size = Math.min(maxSize, (width * 0.94) / widest, (height * 0.8) / (n * lineHeight));
      // Une ligne de plus doit apporter un vrai gain pour être retenue.
      if (size > best.size * 1.04) best = { lines, size };
    }
  }
  return best;
}
