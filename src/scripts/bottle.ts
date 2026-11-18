// Bouteille de bière 33 cl « longneck » générée à 100 % en code.
// Aucun fichier 3D : verre, liquide, étiquette, collerette et capsule
// sont construits à partir d'un profil de révolution (LatheGeometry).
//
// Unité : 1 = 1 cm. La bouteille fait ≈ 23 cm de haut, 6 cm de diamètre.
// Le pied de la bouteille est en y = 0.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Beer } from '../data/types';

/* ------------------------------------------------------------------ */
/* Profil de la bouteille                                              */
/* ------------------------------------------------------------------ */

const R_BODY = 3.0; // rayon du corps
const HEEL = 0.6; // hauteur de l'arrondi du talon
const SHOULDER_START = 12.6;
const SHOULDER_END = 17.2;
const R_NECK = 1.36;
const R_NECK_TOP = 1.24;
const LIP_START = 21.25; // début de la bague (sous la capsule)
const R_LIP = 1.43;
const GLASS_TOP = 22.55;

export const BOTTLE_HEIGHT = 23.2; // capsule comprise
const FILL_LEVEL = 18.2; // remplissage ≈ 4/5, jusque dans le col
const WALL = 0.2; // épaisseur du verre + jeu

const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Rayon extérieur du verre à la hauteur y (cm). */
export function glassRadius(y: number): number {
  if (y < HEEL) {
    const t = y / HEEL;
    return 2.55 + (R_BODY - 2.55) * Math.sqrt(1 - (1 - t) * (1 - t));
  }
  if (y < SHOULDER_START) return R_BODY;
  if (y < SHOULDER_END) {
    // épaule douce en S
    const t = (y - SHOULDER_START) / (SHOULDER_END - SHOULDER_START);
    return R_BODY + (R_NECK - R_BODY) * smoother(t);
  }
  if (y < LIP_START) {
    const t = (y - SHOULDER_END) / (LIP_START - SHOULDER_END);
    return R_NECK + (R_NECK_TOP - R_NECK) * t;
  }
  if (y < LIP_START + 0.25) {
    const t = (y - LIP_START) / 0.25;
    return R_NECK_TOP + (R_LIP - R_NECK_TOP) * smoother(t);
  }
  return R_LIP;
}

/** Hauteurs d'échantillonnage : fines là où la forme courbe, larges sur le corps droit. */
function sampleHeights(from: number, to: number): number[] {
  const ranges: [number, number, number][] = [
    [0, HEEL, 0.05],
    [HEEL, SHOULDER_START, 1.0],
    [SHOULDER_START, SHOULDER_END, 0.1],
    [SHOULDER_END, LIP_START, 0.5],
    [LIP_START, LIP_START + 0.25, 0.05],
    [LIP_START + 0.25, GLASS_TOP, 0.25],
  ];
  const ys: number[] = [];
  for (const [a, b, step] of ranges) {
    for (let y = a; y < b; y += step) if (y >= from && y <= to) ys.push(y);
  }
  ys.push(to);
  return ys;
}

function glassProfile(): THREE.Vector2[] {
  const pts = [new THREE.Vector2(0, 0)];
  for (const y of sampleHeights(0, GLASS_TOP - 0.05)) pts.push(new THREE.Vector2(glassRadius(y), y));
  // lèvre du goulot, arrondie vers l'intérieur
  pts.push(new THREE.Vector2(1.3, GLASS_TOP), new THREE.Vector2(0.95, GLASS_TOP));
  return pts;
}

function liquidProfile(): THREE.Vector2[] {
  const bottom = 0.35;
  const pts = [new THREE.Vector2(0, bottom)];
  for (const y of sampleHeights(bottom, FILL_LEVEL)) {
    pts.push(new THREE.Vector2(Math.max(0.05, glassRadius(y) - WALL), y));
  }
  pts.push(new THREE.Vector2(0, FILL_LEVEL)); // surface du liquide
  return pts;
}

/** Capsule couronne : profil de révolution puis 21 cannelures en bas de jupe. */
function capGeometry(): THREE.BufferGeometry {
  const pts = [
    [1.6, 21.78], [1.57, 21.9], [1.53, 22.15], [1.5, 22.4], [1.47, 22.52],
    [1.38, 22.6], [1.1, 22.63], [0, 22.63],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 126);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const crimp = THREE.MathUtils.clamp((22.45 - v.y) / 0.65, 0, 1);
    if (crimp > 0) {
      const a = Math.atan2(v.x, v.z);
      const k = 1 + 0.05 * crimp * Math.cos(21 * a);
      pos.setXYZ(i, v.x * k, v.y, v.z * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Kit partagé : géométries, environnement, textures                   */
/* ------------------------------------------------------------------ */

export interface BottleKit {
  renderer: THREE.WebGLRenderer;
  /** Studio avec bandeaux : reflets nets du verre et de la capsule. */
  envMap: THREE.Texture;
  /** Pièce neutre : éclairage doux et fidèle pour l'étiquette. */
  envSoft: THREE.Texture;
  glass: THREE.LatheGeometry;
  liquid: THREE.LatheGeometry;
  label: THREE.CylinderGeometry;
  collar: THREE.CylinderGeometry;
  cap: THREE.BufferGeometry;
  bubbleSprite: THREE.Texture;
  labelTexture(beer: Beer): Promise<THREE.Texture>;
  collarTexture(beer: Beer): THREE.Texture;
}

const LABEL_RADIUS = R_BODY + 0.035; // posée juste au-dessus du verre
const LABEL_ARC = THREE.MathUtils.degToRad(220); // couvre 220° de la circonférence
const LABEL_ASPECT = 1.607; // ratio des étiquettes déroulées de la brasserie
// Hauteur calculée pour que l'étiquette ne soit jamais déformée :
// longueur d'arc / ratio de l'image.
const LABEL_HEIGHT = (LABEL_RADIUS * LABEL_ARC) / LABEL_ASPECT;
const LABEL_CENTER_Y = 6.4;
const COLLAR_BOTTOM = 18.7;
const COLLAR_TOP = 20.3;

/** Environnement studio : RoomEnvironment + deux bandeaux lumineux verticaux
 *  qui dessinent les reflets nets typiques d'une photo produit. */
function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const room = new RoomEnvironment();
  const strip = new THREE.BoxGeometry(1, 1, 1);
  const bright = (k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(k) });
  const left = new THREE.Mesh(strip, bright(120));
  left.position.set(-5, 2, 10);
  left.scale.set(3.2, 24, 0.2);
  left.lookAt(0, 1, 0);
  const right = new THREE.Mesh(strip, bright(50));
  right.position.set(8, 2, 7);
  right.scale.set(1.6, 24, 0.2);
  right.lookAt(0, 1, 0);
  room.add(left, right);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.02).texture;
  pmrem.dispose();
  return env;
}

function softEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

function makeBubbleSprite(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Collerette du col : bande « foil » noire avec la signature de la brasserie. */
function drawCollar(beer: Beer): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 200;
  const g = c.getContext('2d')!;
  g.fillStyle = '#141414';
  g.fillRect(0, 0, c.width, c.height);
  // filets dorés haut et bas
  g.fillStyle = beer.color;
  g.fillRect(0, 14, c.width, 6);
  g.fillRect(0, c.height - 20, c.width, 6);
  g.font = '700 58px "Inter Variable", Inter, sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = '#F7F3EA';
  const text = 'MAELSTRÖM  ✦  ';
  const w = g.measureText(text).width;
  // répété sur toute la circonférence, raccord invisible
  const reps = Math.max(1, Math.round(c.width / w));
  g.save();
  g.scale(c.width / (w * reps), 1);
  for (let i = 0; i < reps; i++) g.fillText(text, i * w, c.height / 2 + 2);
  g.restore();
  return c;
}

/** Rend la main au navigateur entre deux étapes lourdes (pas de longue tâche bloquante). */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export async function createBottleKit(renderer: THREE.WebGLRenderer): Promise<BottleKit> {
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();
  const labels = new Map<string, Promise<THREE.Texture>>();
  const collars = new Map<string, THREE.Texture>();
  // Les deux éclairages d'environnement sont calculés en deux temps.
  const envMap = studioEnvironment(renderer);
  await nextFrame();
  const envSoft = softEnvironment(renderer);
  await nextFrame();

  return {
    renderer,
    envMap,
    envSoft,
    glass: new THREE.LatheGeometry(glassProfile(), 64),
    liquid: new THREE.LatheGeometry(liquidProfile(), 48),
    // Cylindre ouvert, centré sur la face avant (theta = 0 regarde la caméra).
    label: new THREE.CylinderGeometry(
      LABEL_RADIUS, LABEL_RADIUS, LABEL_HEIGHT, 96, 1, true, -LABEL_ARC / 2, LABEL_ARC,
    ),
    collar: new THREE.CylinderGeometry(
      glassRadius(COLLAR_TOP) + 0.03, glassRadius(COLLAR_BOTTOM) + 0.03,
      COLLAR_TOP - COLLAR_BOTTOM, 64, 1, true,
    ),
    cap: capGeometry(),
    bubbleSprite: makeBubbleSprite(),

    labelTexture(beer) {
      let p = labels.get(beer.slug);
      if (!p) {
        p = loader.loadAsync(beer.label).then((tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = anisotropy;
          return tex;
        });
        labels.set(beer.slug, p);
      }
      return p;
    },

    collarTexture(beer) {
      let tex = collars.get(beer.slug);
      if (!tex) {
        tex = new THREE.CanvasTexture(drawCollar(beer));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = anisotropy;
        tex.wrapS = THREE.RepeatWrapping;
        collars.set(beer.slug, tex);
      }
      return tex;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Matériaux                                                           */
/* ------------------------------------------------------------------ */

/**
 * Verre ambré. Le canvas est transparent (le fond coloré est en CSS derrière),
 * donc la transmission physique ne verrait que du vide : on simule le verre
 * avec une opacité qui dépend de l'angle (effet Fresnel) — fin et clair au centre,
 * dense et sombre sur les bords — et des reflets qui restent toujours opaques.
 */
function glassMaterial(side: THREE.Side, minAlpha: number): THREE.MeshPhysicalMaterial {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x2e1404,
    roughness: 0.06,
    metalness: 0,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
    transparent: true,
    depthWrite: false,
    side,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uMinAlpha = { value: minAlpha };
    shader.fragmentShader =
      'uniform float uMinAlpha;\n' +
      shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        /* glsl */ `#include <opaque_fragment>
        float facing = abs(dot(normalize(vViewPosition), normal));
        float fresnel = pow(1.0 - facing, 1.8);
        float glow = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        gl_FragColor.a = clamp(max(mix(uMinAlpha, 0.97, fresnel), glow * 1.4), 0.0, 1.0);`,
      );
  };
  return m;
}

/* ------------------------------------------------------------------ */
/* La bouteille                                                        */
/* ------------------------------------------------------------------ */

interface BottleOptions {
  bubbles: boolean;
}

const BUBBLES = 60;
/** Ce que laisse passer un verre ambré (rouge > vert > bleu). */
const AMBER_FILTER = new THREE.Color(0.62, 0.35, 0.14);

export class Bottle {
  /** Animé par GSAP (entrée, sortie, glisser). */
  readonly root = new THREE.Group();
  /** Balancement au repos, piloté par `idle` (0 → immobile, 1 → balancement complet). */
  readonly sway = new THREE.Group();
  idle = 1;
  beer: Beer | null = null;

  private inner = new THREE.Group();
  private labelMat: THREE.MeshPhysicalMaterial;
  private collarMat: THREE.MeshPhysicalMaterial;
  private capMat: THREE.MeshStandardMaterial;
  private liquidFront: THREE.MeshBasicMaterial;
  private liquidBack: THREE.MeshBasicMaterial;
  private bubbles?: THREE.Points;
  private bubbleState?: { frac: Float32Array; angle: Float32Array; speed: Float32Array; phase: Float32Array };
  private phase = Math.random() * 10;

  constructor(private kit: BottleKit, opts: BottleOptions) {
    this.root.add(this.sway);
    this.sway.add(this.inner);
    this.inner.position.y = -BOTTLE_HEIGHT / 2; // la bouteille tourne autour de son centre

    // Ordre de rendu des objets transparents, de l'arrière vers l'avant :
    // paroi arrière du verre → liquide (arrière) → bulles → liquide (avant) → paroi avant.
    const glassBack = new THREE.Mesh(kit.glass, glassMaterial(THREE.BackSide, 0.25));
    glassBack.renderOrder = 1;

    // Le liquide n'a pas de reflets propres (il est derrière le verre) : matériau non éclairé,
    // c'est le verre devant lui qui porte les reflets et le modelé.
    this.liquidBack = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.92, depthWrite: false, side: THREE.BackSide,
    });
    this.liquidFront = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.72, depthWrite: false, side: THREE.FrontSide,
    });
    const liquidBack = new THREE.Mesh(kit.liquid, this.liquidBack);
    liquidBack.renderOrder = 2;
    const liquidFront = new THREE.Mesh(kit.liquid, this.liquidFront);
    liquidFront.renderOrder = 4;

    const glassFront = new THREE.Mesh(kit.glass, glassMaterial(THREE.FrontSide, 0.45));
    glassFront.renderOrder = 5;

    // Étiquette : face avant imprimée, dos en papier brut visible à travers le verre.
    this.labelMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.6, clearcoat: 0.16, clearcoatRoughness: 0.35,
      envMap: kit.envSoft, envMapIntensity: 0.62,
    });
    const label = new THREE.Mesh(kit.label, this.labelMat);
    const labelBack = new THREE.Mesh(
      kit.label,
      new THREE.MeshStandardMaterial({
        color: 0xd9d0bf, roughness: 0.9, side: THREE.BackSide, envMap: kit.envSoft, envMapIntensity: 0.4,
      }),
    );
    label.position.y = labelBack.position.y = LABEL_CENTER_Y;

    this.collarMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.32, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.15,
    });
    const collar = new THREE.Mesh(kit.collar, this.collarMat);
    collar.position.y = (COLLAR_TOP + COLLAR_BOTTOM) / 2;

    this.capMat = new THREE.MeshStandardMaterial({ metalness: 0.92, roughness: 0.26, envMapIntensity: 1.2 });
    const cap = new THREE.Mesh(kit.cap, this.capMat);

    this.inner.add(label, labelBack, collar, cap, glassBack, liquidBack, liquidFront, glassFront);

    if (opts.bubbles) this.createBubbles();
  }

  private createBubbles() {
    const positions = new Float32Array(BUBBLES * 3);
    const s = {
      frac: new Float32Array(BUBBLES),
      angle: new Float32Array(BUBBLES),
      speed: new Float32Array(BUBBLES),
      phase: new Float32Array(BUBBLES),
    };
    for (let i = 0; i < BUBBLES; i++) {
      s.frac[i] = Math.sqrt(Math.random()) * 0.85;
      s.angle[i] = Math.random() * Math.PI * 2;
      s.speed[i] = 1.2 + Math.random() * 2.2;
      s.phase[i] = Math.random() * 10;
      positions[i * 3 + 1] = 0.6 + Math.random() * (FILL_LEVEL - 1.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.17, map: this.kit.bubbleSprite, transparent: true, depthWrite: false,
      opacity: 0.8, color: 0xffffff, sizeAttenuation: true,
    });
    this.bubbles = new THREE.Points(geo, mat);
    this.bubbles.renderOrder = 3;
    this.bubbleState = s;
    this.inner.add(this.bubbles);
  }

  /** Change de bière : étiquette, collerette, liquide et capsule. */
  setBeer(beer: Beer, label: THREE.Texture | null) {
    this.beer = beer;
    this.labelMat.map = label;
    this.labelMat.color.set(label ? 0xffffff : beer.color);
    this.labelMat.needsUpdate = true;
    this.collarMat.map = this.kit.collarTexture(beer);
    this.collarMat.needsUpdate = true;
    // couleur de la bière vue à travers le verre ambré (filtre brun)
    const liquid = new THREE.Color(beer.liquid).multiply(AMBER_FILTER);
    this.liquidFront.color.copy(liquid);
    this.liquidBack.color.copy(liquid).multiplyScalar(0.6);
    this.capMat.color.set(beer.accent);
  }

  /** Applique l'étiquette quand elle arrive après coup (chargement réseau). */
  setLabel(beer: Beer, label: THREE.Texture) {
    if (this.beer?.slug !== beer.slug) return;
    this.setBeer(beer, label);
  }

  update(dt: number, time: number) {
    // balancement lent qui laisse voir le nom sur le côté de l'étiquette
    const t = time + this.phase;
    this.sway.rotation.y = Math.sin(t * 0.55) * 0.36 * this.idle;
    this.sway.rotation.z = Math.sin(t * 0.8) * 0.015 * this.idle;

    if (this.bubbles && this.bubbleState) {
      const s = this.bubbleState;
      const pos = this.bubbles.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < BUBBLES; i++) {
        let y = arr[i * 3 + 1] + s.speed[i] * dt;
        if (y > FILL_LEVEL - 0.25) {
          y = 0.5;
          s.angle[i] = Math.random() * Math.PI * 2;
          s.frac[i] = Math.sqrt(Math.random()) * 0.85;
        }
        // les bulles suivent la forme de la bouteille (corps → épaule → col)
        const r = (glassRadius(y) - WALL - 0.2) * s.frac[i];
        const wobble = Math.sin(time * 4 + s.phase[i]) * 0.04;
        arr[i * 3] = Math.sin(s.angle[i]) * r + wobble;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.cos(s.angle[i]) * r;
      }
      pos.needsUpdate = true;
    }
  }
}
