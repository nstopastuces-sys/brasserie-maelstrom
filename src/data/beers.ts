// Point d'accès unique aux données des bières, avec les chemins d'étiquettes
// adaptés au dossier de publication du site.
import data from './beers.json';
import type { Beer } from './types';
import { withBase } from '../scripts/paths';

export const beers: Beer[] = (data as Beer[]).map((b) => ({ ...b, label: withBase(b.label) }));
