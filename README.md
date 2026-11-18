# Brasserie Maelström — site vitrine

Site statique (Astro + Three.js + GSAP + Lenis) de la Brasserie Maelström, brasserie artisanale
de Haute-Savoie. Hébergement gratuit : GitHub + Netlify. Budget outils et licences : 0 €.

Le cahier des charges complet est dans [docs/cahier-des-charges.md](docs/cahier-des-charges.md).

## État actuel : démo de présentation

La démo se concentre sur le **carrousel hero**, l'argument commercial du projet :

- bouteille 33 cl longneck **100 % générée en code** (aucun modèle 3D), verre ambré, liquide,
  collerette, capsule couronne à la couleur de la bière, bulles ;
- les **vraies étiquettes** de la brasserie plaquées sans déformation (récupérées sur le site actuel) ;
- transition d'environ 1,1 s : vague de mousse puis de bière, nom géant lettre par lettre,
  ingrédients illustrés qui s'éparpillent, bouteille qui sort en pivotant puis nouvelle bouteille
  qui fait un demi-tour et se pose ;
- glisser (souris / doigt), flèches clavier, pastilles, boutons, autoplay 6 s avec pause,
  lien partageable (`/#white-abyss`) ;
- repli 2D (étiquette en carte) si WebGL est absent ou si « réduire les animations » est actif.

Sous le hero, des sections d'aperçu : portes ouvertes, gamme filtrable, espace pros, la brasserie,
pied de page avec la mention sanitaire.

**Provisoire** (à valider avec la brasserie) : accroches des bières, couleurs, textes des sections,
date des portes ouvertes, adresse, horaires. Les degrés et IBU ne sont pas affichés tant qu'ils
ne sont pas fournis (`null` dans `src/data/beers.json`).

### Écarts assumés par rapport au cahier des charges

- **Molette** : la molette verticale fait défiler la page (sinon le visiteur reste bloqué dans le
  hero). Le geste horizontal du trackpad, ou Maj + molette, change de bière.
- **Verre** : le fond coloré est en CSS derrière un canvas transparent ; une vraie transmission
  physique ne « verrait » rien derrière la bouteille. Le verre est donc simulé (opacité selon
  l'angle, reflets de studio), ce qui est aussi plus léger sur mobile.
- **Tone mapping** : `NeutralToneMapping` plutôt qu'ACES, pour respecter les couleurs des étiquettes.
- **Nom** : l'étiquette indique « Patcha Mama » ; le slug reste `pachamama`.

## Commandes

```sh
npm install          # dépendances
npm run dev          # serveur de développement → http://localhost:4321
npm run build        # site statique dans dist/
npm run preview      # sert dist/ en local
npx astro check      # vérification des types
```

Pages utiles :

- `/` : accueil avec le carrousel ;
- `/test-bouteille` : bouteille seule, pour contrôler le rendu 3D (paramètres `?b=3&spin=0&ry=0.5`).

### Étiquettes

Les étiquettes sont des visuels déroulés (ratio ≈ 1,6) convertis en WebP 1024 px :

```sh
npm run labels -- <dossier-des-fichiers-sources>
```

La correspondance fichier → bière est dans `scripts/prepare-labels.mjs`. Les quatre étiquettes
« bio » et No Country For Old Men ne font que 490 px de large : il faudra demander les fichiers
haute définition à la brasserie.

### Captures de contrôle (Playwright)

```sh
npm run shot -- http://localhost:4321/ capture.png 1440 900 3000
node scripts/filmstrip.mjs http://localhost:4321/ film.png 1440 900 "100,300,500,800,1300"
```

`filmstrip` décompose une transition au ralenti (×10) en une planche d'images.

## Structure

```
src/
  components/   BeerCarousel (hero), Header, Footer, AgeGate, RangeGrid, OpenDays, ProsBlock, Story…
  data/         beers.json (une entrée par bière) et types
  layouts/      Base.astro (SEO, polices, en-tête, pied de page)
  pages/        index, test-bouteille
  scripts/      bottle.ts (bouteille procédurale), stage.ts (scène Three.js),
                carousel.ts (transitions et interactions), site.ts, color.ts, name-fit.ts
public/labels/  étiquettes WebP
netlify.toml    build + en-têtes de sécurité (CSP, HSTS…)
```

## Déploiement Netlify

1. Sur Netlify : « Add new site » → « Import an existing project » → GitHub → ce dépôt.
2. Les réglages sont lus dans `netlify.toml` (build `npm run build`, dossier `dist`, Node 24).
3. Chaque push sur `main` redéploie le site.

## Suite prévue

Étapes 4 et 5 du cahier des charges : fiches bières générées depuis `beers.json`, pages pros,
événements (Netlify Forms, .ics), contact (Leaflet + OpenStreetMap), pages légales, JSON-LD,
sitemap, script `capture-bottles` pour le repli PNG, audit Lighthouse.
