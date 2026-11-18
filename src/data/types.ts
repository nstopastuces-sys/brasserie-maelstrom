// Types partagés pour les données du site.

/** Ingrédients illustrés en SVG (cf. src/components/IngredientSprite.astro). */
export type Ingredient = 'hop' | 'wheat' | 'barley' | 'grain' | 'pear' | 'caramel' | 'flake';

export interface Beer {
  slug: string;
  name: string;
  style: string;
  /** Famille utilisée par les filtres : ipa, pale, stout-porter, blanche, ambree, blonde. */
  category: string;
  /** Gamme : permanente, éphémère ou bio. */
  range: 'permanente' | 'ephemere' | 'bio';
  /** Degré d'alcool (% vol.) — à fournir par la brasserie. */
  abv: number | null;
  ibu: number | null;
  tagline: string;
  description: string;
  pairing: string[];
  formats: string[];
  organic: boolean;
  /** Couleur de fond quand la bière est active. */
  color: string;
  /** Couleur du nom géant derrière la bouteille. */
  colorDeep: string;
  /** Couleur de la capsule et des détails. */
  accent: string;
  /** Couleur du liquide dans la bouteille 3D. */
  liquid: string;
  /** Étiquette déroulée (WebP, ratio ≈ 1,6). */
  label: string;
  ingredients: Ingredient[];
}

export const RANGE_LABEL: Record<Beer['range'], string> = {
  permanente: 'Gamme permanente',
  ephemere: 'Éphémère',
  bio: 'Bio',
};
