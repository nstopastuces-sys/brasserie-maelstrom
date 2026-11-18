// Convertit les visuels d'étiquettes fournis par la brasserie en WebP 1024 px
// (format attendu par la bouteille 3D : étiquette déroulée, ratio ≈ 1,6).
//
// Usage : npm run labels -- <dossier-source>
// Le dossier source contient les fichiers d'origine (noms du site actuel).

import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

// Nom du fichier source → slug de la bière (cf. src/data/beers.json)
const SOURCES = {
  'PM_Plan-de-travail-1.jpg': 'pachamama',
  'WA.jpg': 'white-abyss',
  'DD.jpg': 'diamond-dogs',
  'LH.jpg': 'last-hops',
  '97363815_2661126184125228_2780596152809029632_n.png': 'fake-smile',
  'NCFOM.jpg': 'no-country-for-old-men',
  'GMJ.jpg': 'good-morning-japan',
  'GMA.jpg': 'good-morning-america',
  'PP.jpg': 'porter-poires',
  'Bio-blanche.jpg': 'blanche-bio',
  'Bio-ambree.jpg': 'ambree-bio',
  'bio-blonde.jpg': 'blonde-bio',
};

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Usage : npm run labels -- <dossier-source>');
  process.exit(1);
}

const outDir = resolve('public/labels');
await mkdir(outDir, { recursive: true });

for (const [file, slug] of Object.entries(SOURCES)) {
  const out = join(outDir, `${slug}.webp`);
  const img = sharp(join(srcDir, file)).flatten({ background: '#ffffff' });
  const meta = await img.metadata();
  // On ne grossit jamais une image trop petite : on garde sa taille d'origine.
  const width = Math.min(1024, meta.width ?? 1024);
  // Le visuel Fake Smile a un filet noir d'un pixel sur le pourtour : on le rogne.
  const pipeline = slug === 'fake-smile'
    ? img.extract({ left: 3, top: 3, width: meta.width - 6, height: meta.height - 6 })
    : img;
  await pipeline.resize({ width }).webp({ quality: 86 }).toFile(out);
  console.log(`✓ ${slug}.webp (${width}px)`);
}
