# Brasserie Maelström — Cahier des charges & prompt Codex

18 nov. 2026

## Contexte et objectifs

Le site doit faire commander les pros et remplir les journées portes ouvertes, avec une home dont le carrousel de bières en bouteille 33 cl devient la signature de la marque. Budget outils et licences : 0 €.

- **Client** : Brasserie Maelström, brasserie artisanale savoyarde, ton jeune et dynamique. Gamme actuelle visible sur brasserie-maelstrom.com/nos-bieres.
- **Cible 1, les pros** : restaurants, bars, cavistes. Objectif : demande de tarifs ou de devis, téléchargement des fiches techniques, prise de contact rapide.
- **Cible 2, le grand public local** : 2 à 3 journées d'ouverture par an pour des événements. Objectif : inscription ou rappel de date, venue sur place.
- Pas de vente en ligne au lancement : pas de paiement, pas de panier, pas de TVA à gérer.
- **Contrainte gratuite** : uniquement des bibliothèques open source ou gratuites, des polices libres, un hébergement gratuit (GitHub + Netlify). Aucun modèle 3D, template, plugin ou service payant.
- **Référence d'ambiance** : KMBCH (fond couleur par produit, ingrédient illustré derrière la bouteille), SPYLT (scroll narratif), Bunta Beer et Cerveza Oleaje sur Awwwards (produit 3D au scroll).

## Direction artistique

L'identité tient en une phrase : chaque bière est un univers de couleur, la montagne est le fil rouge. Le site reste sobre (noir profond, blanc cassé) et c'est la bière active qui colore tout l'écran.

- **Ton** : jeune, direct, un peu décalé, tutoiement. Phrases courtes. Pas de clichés « tradition et terroir » sans preuve.
- **Couleur** : une couleur dominante par bière, extraite de son étiquette, stockée dans les données (color, colorDeep, accent). Le fond de la home, les boutons et le curseur prennent cette couleur.
- **Typographie (gratuite)** : un titrage condensé très gras pour les noms géants derrière la bouteille (piste : Anton ou Bebas Neue sur Google Fonts, ou une police Fontshare gratuite), et un texte courant lisible (Inter ou Manrope). Polices auto-hébergées en WOFF2.
- **Motifs savoyards** : silhouette de crêtes en SVG à la ligne du bas du hero, légère texture de grain. Ingrédients illustrés en SVG simples (houblon, poire, grain, flocon).
- **Motion** : rapide et franc, jamais mou. Transitions de 0,9 à 1,2 s, courbe power3.inOut / expo.out. Défilement lissé par Lenis. Respect de prefers-reduced-motion : fondu simple, pas de rotation.
- **Photo** : vraies photos de la brasserie, de l'équipe et des portes ouvertes, à fournir par le client. Pas de banque d'images.

## Le carrousel hero

La bouteille 33 cl est générée en code dans Three.js (aucun modèle 3D à acheter ni à modéliser) et l'étiquette de chaque bière y est plaquée comme texture. Changer de bière = changer une texture et une couleur.

### La bouteille procédurale

- **Verre** : LatheGeometry à partir d'un profil de bouteille 33 cl (≈ 23 cm de haut, ≈ 6 cm de diamètre pour une longneck ; à caler sur la bouteille réelle de la brasserie). Matériau MeshPhysicalMaterial verre ambré : transmission, roughness faible, thickness, teinte brune.
- **Bière** : un second lathe légèrement plus petit, couleur de la bière (blonde, ambrée, noire pour le stout).
- **Étiquette** : CylinderGeometry ouvert, sans fond, qui couvre environ 60 % de la circonférence, juste au-dessus du verre. Texture = visuel de la bière.
- **Capsule** : petit cylindre métal, couleur accent de la bière.
- **Lumière** : RoomEnvironment de Three.js (inclus, gratuit) pour les reflets, plus une lumière de contre-jour pour découper la silhouette.
- **Bonus** : bulles = petites particules qui montent dans la bière ; gouttes de condensation = texture de normales légère.

### Séquence de transition (1,1 s environ)

1. La bouteille active pivote de 90° sur son axe et part vers la gauche en s'inclinant, comme si on la reposait.
2. En même temps, une vague de mousse (forme SVG ou shader) monte du bas de l'écran avec la couleur de la bière suivante et recouvre le fond.
3. Le nom géant sort lettre par lettre vers le haut ; le nouveau nom entre par le bas (SplitText de GSAP).
4. Les ingrédients illustrés de l'ancienne bière s'éparpillent ; ceux de la nouvelle flottent en parallaxe derrière la bouteille.
5. La nouvelle bouteille entre par la droite, fait un demi-tour complet pour montrer l'étiquette, puis se stabilise de face avec un léger rebond.
6. Style, degré et une phrase d'accroche apparaissent en fondu en bas à gauche ; bouton « Découvrir » vers la fiche.

### Interactions

- Glisser (souris ou doigt), molette, flèches clavier, pastilles numérotées, boutons précédent / suivant.
- Au survol, la bouteille suit doucement le curseur (inclinaison de quelques degrés).
- Défilement automatique toutes les 6 s, mis en pause au survol, au focus et dès la première interaction.
- Boucle infinie. L'URL se met à jour (/#pachamama) pour partager une bière.

### Mobile et repli

- Sur mobile, même scène 3D mais en qualité réduite (pixel ratio limité à 1,5, pas de bulles).
- Si WebGL est absent, si l'appareil est trop lent ou si prefers-reduced-motion est actif : carrousel 2D avec des PNG de bouteilles rendus une fois depuis la scène 3D (script de capture fourni dans le projet) et des fondus de couleur.
- Les noms, styles et liens existent en HTML réel, sous le canvas, pour le SEO et les lecteurs d'écran.

## Pages et contenus

Sept pages suffisent au lancement ; chaque fiche bière est générée automatiquement depuis un seul fichier de données.

| Page | URL | Contenu | Action attendue |
| --- | --- | --- | --- |
| Accueil | `/` | Carrousel hero, bandeau « Prochaine porte ouverte » avec date, bloc Pros, histoire en 3 lignes, photos brasserie | Explorer les bières, cliquer Pros ou Événements |
| Nos bières | `/bieres/` | Grille filtrable (IPA, Pale, Stout/Porter, Bio) avec bouteilles en mini 3D ou PNG | Ouvrir une fiche |
| Fiche bière | `/bieres/<slug>/` | Bouteille 3D rotative, style, degré, IBU, amertume, accords mets, formats (33 cl, fût), bières proches | Télécharger la fiche pro, demander un tarif |
| Espace pros | `/pros/` | Pourquoi nous, formats et conditionnements, zone de livraison, fiches techniques PDF, formulaire de demande de tarifs | Envoyer une demande de devis |
| Portes ouvertes | `/evenements/` | Prochaines dates, programme, accès, parking, photos des éditions passées, ajout au calendrier (.ics) | S'inscrire ou ajouter au calendrier |
| La brasserie | `/brasserie/` | Histoire, équipe, savoir-faire, ancrage savoyard | Confiance, puis contact |
| Contact | `/contact/` | Adresse, carte OpenStreetMap, horaires, formulaire, réseaux | Envoyer un message |

Pages légales obligatoires en plus : mentions légales, confidentialité, et le message sanitaire « L'abus d'alcool est dangereux pour la santé, à consommer avec modération » dans le pied de page de chaque page (loi Évin). Pas de visuel associant l'alcool au sport, à la conduite ou à la réussite sociale.

Âge : une simple bannière de confirmation « J'ai 18 ans ou plus » à la première visite, mémorisée en localStorage, sans bloquer les robots d'indexation.

## Stack technique gratuite et exigences

Tout le site est statique : généré par Astro, hébergé sur Netlify en offre gratuite depuis GitHub, sans base de données ni serveur à payer.

| Brique | Outil | Coût | Rôle |
| --- | --- | --- | --- |
| Framework | Astro | Gratuit (MIT) | Pages statiques, SEO, zéro JS par défaut hors carrousel |
| 3D | Three.js | Gratuit (MIT) | Bouteille procédurale, textures d'étiquettes |
| Animation | GSAP + ScrollTrigger + SplitText | Gratuit | Transitions, textes, scroll |
| Scroll fluide | Lenis | Gratuit (MIT) | Défilement lissé |
| Polices | Google Fonts / Fontshare, auto-hébergées | Gratuit | Titrage et texte courant |
| Formulaires | Netlify Forms | Gratuit (quota mensuel limité) | Devis pros, contact, inscriptions portes ouvertes |
| Carte | OpenStreetMap + Leaflet | Gratuit | Plan d'accès, sans clé API |
| Hébergement | GitHub + Netlify | Gratuit | Déploiement automatique, HTTPS |

### Performance

- Three.js chargé uniquement sur l'accueil et les fiches, en import dynamique après le premier affichage.
- Étiquettes en WebP, 1024 px de large maximum ; images en AVIF/WebP avec srcset.
- Objectifs Lighthouse mobile : Performance ≥ 85, Accessibilité, Bonnes pratiques et SEO ≥ 95. LCP < 2,5 s sur 4G.
- Rendu 3D mis en pause quand le hero sort de l'écran ou que l'onglet est caché.

### SEO et GEO

- Une balise title et une meta description uniques par page ; Open Graph avec image de la bouteille.
- Données structurées JSON-LD : Brewery (adresse, horaires, géo), Product par bière, Event par porte ouverte.
- sitemap.xml, robots.txt, URLs propres en français. Fiche Google Business à relier.
- Textes réels pour chaque bière (pas seulement des visuels), pour être cité par les moteurs IA.

### Accessibilité

- Carrousel utilisable au clavier, avec aria-live qui annonce la bière affichée et un bouton pause visible.
- Contraste du texte vérifié sur chaque couleur de bière (texte noir ou blanc choisi automatiquement).
- prefers-reduced-motion respecté partout.

### Sécurité

- En-têtes dans netlify.toml : CSP stricte, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- Formulaires protégés par champ piège (honeypot) et reCAPTCHA Netlify gratuit si spam.
- Aucun secret dans le dépôt, dépendances à jour (Dependabot GitHub gratuit).

## Données des bières et éléments à récupérer

Le site actuel donne le nom et le style des 12 bières, mais ni degré, ni description, ni format : ces infos sont à demander à la brasserie (source). Les visuels existants sont des images carrées, pas des étiquettes déroulées.

> Note (démo) : les visuels du site actuel sont en réalité des étiquettes déroulées au format paysage (ratio ≈ 1,6), utilisées telles quelles sur la bouteille 3D.

| Bière | Style | Slug | Ingrédients à illustrer |
| --- | --- | --- | --- |
| Pachamama | Session IPA | pachamama | Houblon |
| White Abyss | White IPA | white-abyss | Houblon, blé |
| Diamond Dogs | Pale Ale | diamond-dogs | Houblon |
| Last Hops | Double IPA | last-hops | Houblon |
| Fake Smile | Stout | fake-smile | Grain torréfié |
| No Country For Old Men | DDH East IPA | no-country-for-old-men | Houblon |
| Good Morning Japan | Hazy IPA | good-morning-japan | Houblon |
| Good Morning America | New England IPA | good-morning-america | Houblon |
| Porter Poires | Porter | porter-poires | Poire, grain torréfié |
| Blanche Bio | Blanche | blanche-bio | Blé, épis |
| Ambrée Bio | Ambrée | ambree-bio | Orge, caramel |
| Blonde Bio | Blonde | blonde-bio | Orge |

Format du fichier `src/data/beers.json`, une entrée par bière :

```json
{
  "slug": "pachamama",
  "name": "Pachamama",
  "style": "Session IPA",
  "category": "ipa",
  "abv": null,
  "ibu": null,
  "tagline": "À compléter",
  "description": "À compléter",
  "pairing": [],
  "formats": ["33 cl"],
  "organic": false,
  "color": "#E8A33D",
  "colorDeep": "#8A4B12",
  "accent": "#1B1B1B",
  "liquid": "#F2B544",
  "label": "/labels/pachamama.webp",
  "ingredients": ["hop"]
}
```

### À demander à la brasserie

- [ ] Fichiers d'impression des étiquettes au format déroulé (PDF ou PNG haute définition) ; à défaut, les visuels carrés en haute définition
- [ ] Modèle exact de la bouteille 33 cl (longneck, steinie…) et couleur du verre et de la capsule
- [ ] Degré, IBU, description et accords mets de chaque bière ; gamme permanente ou saisonnière
- [ ] Formats pros (fûts, cartons), zone de livraison, conditions pour les pros
- [ ] Dates des prochaines portes ouvertes et programme
- [ ] Logo vectoriel (SVG), photos de la brasserie et de l'équipe
- [ ] Adresse, horaires, SIRET et informations pour les mentions légales

## Prompts Codex, étape par étape

Lance les prompts dans l'ordre, un par session, et vérifie le rendu dans le navigateur avant de passer au suivant. L'étape 2 est la plus risquée : valide la bouteille avant tout le reste.

### Étape 1 — Socle du projet

Crée un site statique Astro (dernière version stable) pour la « Brasserie Maelström », brasserie artisanale savoyarde au ton jeune.
Contrainte absolue : uniquement des dépendances gratuites et open source. Aucun service, template, modèle 3D ou plugin payant.
Installe : three, gsap, lenis. Polices auto-hébergées en WOFF2 : Anton (titres) et Inter (texte).
Structure : src/pages (index, bieres/index, bieres/[slug], pros, evenements, brasserie, contact, mentions-legales, confidentialite), src/components, src/layouts/Base.astro, src/data/beers.json, public/labels.
Remplis beers.json avec les 12 bières fournies (slug, name, style, category, organic, et des couleurs provisoires cohérentes avec le style). Laisse abv, ibu et description à null ou « À compléter ».
Layout de base : header minimal (logo texte, menu, bouton « Espace pros »), footer avec adresse, réseaux et la mention obligatoire « L'abus d'alcool est dangereux pour la santé, à consommer avec modération ».
Ajoute une bannière d'âge « J'ai 18 ans ou plus » mémorisée en localStorage (protégée par try/catch), non bloquante pour les robots.
Ajoute netlify.toml avec les en-têtes de sécurité (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
Code en TypeScript, propre, commenté en français. Pas encore de 3D.

### Étape 2 — La bouteille 33 cl en Three.js

Crée src/scripts/bottle.ts : une classe Bottle qui génère une bouteille de bière 33 cl longneck 100 % en code, sans fichier 3D.

- Verre : LatheGeometry depuis un profil réaliste (corps cylindrique ≈ 6 cm de diamètre, épaule douce, col fin, bague, hauteur ≈ 23 cm), 64 segments. MeshPhysicalMaterial verre ambré (transmission 0.9, roughness 0.05, thickness 0.5, ior 1.5, teinte brune).
- Liquide : second lathe intérieur rempli aux 4/5, couleur = beer.liquid.
- Étiquette : CylinderGeometry ouvert couvrant 220° de la circonférence, posé légèrement au-dessus du verre sur le corps. Texture = beer.label (colorSpace sRGB, anisotropy max). Méthode setBeer(beer) qui change texture, liquide et capsule.
- Capsule : cylindre métal couleur beer.accent.
- Éclairage : RoomEnvironment + PMREMGenerator, une lumière directionnelle de contre-jour.
- Bulles : 60 petites particules qui montent dans le liquide (désactivées sur mobile).

Crée une page de test /test-bouteille qui affiche la bouteille qui tourne lentement, avec des boutons pour changer de bière. Renderer : antialias, pixel ratio max 2 (1,5 sur mobile), toneMapping ACESFilmic. Pause du rendu si l'onglet est caché.
Si l'étiquette est carrée, adapte l'UV pour la centrer sur la face avant sans déformation.

### Étape 3 — Le carrousel hero et ses transitions

Crée le composant Hero (src/components/BeerCarousel.astro + src/scripts/carousel.ts) pour la page d'accueil, plein écran, en réutilisant la classe Bottle.
Calques, de l'arrière vers l'avant : fond de couleur (beer.color), nom géant de la bière en Anton (≈ 22vw, couleur beer.colorDeep), ingrédients SVG flottants en parallaxe, canvas Three.js avec la bouteille, silhouette SVG de montagnes en bas, infos (style, degré, accroche, bouton « Découvrir ») en bas à gauche, pastilles et flèches en bas à droite.

Transition vers la bière suivante, timeline GSAP d'environ 1,1 s :

1. La bouteille pivote de 90° et sort vers la gauche en s'inclinant.
2. Une vague SVG animée (forme de mousse) monte du bas avec la nouvelle couleur et recouvre le fond.
3. Le nom sort lettre par lettre vers le haut (SplitText) ; le nouveau nom entre par le bas.
4. Les ingrédients sortants s'éparpillent, les nouveaux apparaissent en fondu.
5. La nouvelle bouteille entre par la droite, fait un demi-tour pour montrer l'étiquette, se stabilise de face avec un léger rebond (back.out).
6. Les infos apparaissent en fondu décalé.

Interactions : glisser souris/doigt, molette (une bière par cran, avec anti-rebond), flèches clavier, pastilles, boutons. Bouteille qui suit doucement le curseur (± 8°). Autoplay 6 s, mis en pause au survol, au focus, à la première interaction, et bouton pause visible. Boucle infinie. Mise à jour du hash d'URL (#slug) et lecture du hash au chargement.
Interdit d'enchaîner deux transitions en même temps : file d'attente ou blocage pendant l'animation.
Accessibilité : liste HTML réelle des bières sous le canvas (nom, style, lien), aria-live="polite" pour annoncer la bière affichée. Texte noir ou blanc choisi automatiquement selon le contraste avec beer.color.
Repli : si WebGL indisponible ou prefers-reduced-motion, afficher des PNG de bouteilles (public/bottles/<slug>.png) avec de simples fondus de couleur. Ajoute un script npm "capture-bottles" qui rend chaque bouteille en PNG transparent 1200 px de haut depuis la scène 3D.
Three.js chargé en import dynamique après le premier affichage ; le premier écran s'affiche avec le PNG de la première bière pour un bon LCP.

### Étape 4 — Pages bières, pros et événements

Construis les pages à partir de beers.json, dans le même style que le hero (couleur de la bière, Anton, transitions GSAP sobres, Lenis).

- /bieres/ : grille filtrable (Toutes, IPA, Pale, Stout/Porter, Bio), cartes avec PNG de bouteille qui s'incline au survol.
- /bieres/[slug]/ : bouteille 3D rotative au scroll (ScrollTrigger), style, degré, IBU, description, accords mets, formats, 3 bières proches, boutons « Demander un tarif » et « Fiche technique PDF ».
- /pros/ : arguments, formats et conditionnements, zone de livraison, fiches techniques, formulaire Netlify Forms (établissement, type : restaurant/bar/caviste, ville, bières souhaitées en cases à cocher, volume estimé, message), honeypot, page de remerciement.
- /evenements/ : liste d'événements depuis src/data/events.json (date, titre, programme, adresse), compte à rebours vers le prochain, bouton « Ajouter au calendrier » qui génère un .ics, formulaire d'inscription Netlify Forms.
- /contact/ : carte Leaflet + OpenStreetMap, horaires, formulaire.
- Bandeau « Prochaine porte ouverte » sur l'accueil, masqué automatiquement s'il n'y a pas de date à venir.

### Étape 5 — SEO, performance et finitions

Finalise le site pour la mise en ligne :

- title et meta description uniques par page, Open Graph et Twitter Card avec image de bouteille, URL canonique.
- JSON-LD : Brewery sur l'accueil et le contact, Product sur chaque fiche bière, Event sur chaque porte ouverte, BreadcrumbList.
- @astrojs/sitemap, robots.txt, 404 personnalisée avec une bouteille renversée.
- Images en AVIF/WebP avec srcset, lazy loading hors écran, polices préchargées.
- Rendu 3D mis en pause hors écran (IntersectionObserver) et quand l'onglet est caché.
- Vérifie : navigation complète au clavier, focus visible, contrastes AA, prefers-reduced-motion.
- Vise Lighthouse mobile : Performance ≥ 85, autres scores ≥ 95. Donne-moi la liste de ce qui reste sous ces seuils.

## Critères de recette

Le site est livrable quand tous ces points sont cochés, sur un iPhone, un Android milieu de gamme et un ordinateur.

- [ ] Les 12 bières défilent sans saccade (≥ 50 images/s sur ordinateur, ≥ 30 sur Android milieu de gamme)
- [ ] Les étiquettes sont nettes, centrées et non déformées sur la bouteille
- [ ] Glisser, molette, clavier, pastilles et autoplay fonctionnent ; pas de double transition
- [ ] Le repli PNG s'affiche avec WebGL désactivé et avec « réduire les animations »
- [ ] Les trois formulaires arrivent dans Netlify et la page de remerciement s'affiche
- [ ] Le bandeau de porte ouverte apparaît avec une date future et disparaît sans date
- [ ] Mention sanitaire présente sur toutes les pages ; mentions légales remplies
- [ ] Lighthouse mobile : Performance ≥ 85, autres scores ≥ 95
- [ ] Données structurées validées dans le test des résultats enrichis de Google
- [ ] En-têtes de sécurité vérifiés (securityheaders.com, note A minimum)
- [ ] Coût mensuel : 0 € (hors nom de domaine)
