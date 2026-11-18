// Scène Three.js du carrousel : renderer, caméra, lumières et deux bouteilles
// (l'active et celle qui entre) qui échangent leur rôle à chaque transition.

import * as THREE from 'three';
import { Bottle, BOTTLE_HEIGHT, createBottleKit, type BottleKit } from './bottle';
import type { Beer } from '../data/types';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  /** Qualité réduite : pixel ratio 1,5 et pas de bulles. */
  lowPower: boolean;
}

const FOV = 26;

export class Stage {
  active: Bottle;
  incoming: Bottle;
  /** Demi-largeur visible (unités monde) + marge : position de sortie d'écran. */
  exitX = 40;

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
  private group = new THREE.Group(); // suit le curseur et flotte doucement
  private baseY = 0;
  private pointer = new THREE.Vector2();
  private timer = new THREE.Timer();
  private running = false;
  private started = false;
  private visible = true;
  private frame = 0;

  /** Création asynchrone : l'initialisation lourde est découpée pour ne pas figer la page. */
  static async create(opts: StageOptions): Promise<Stage> {
    const r = new THREE.WebGLRenderer({
      canvas: opts.canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio, opts.lowPower ? 1.5 : 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral plutôt qu'ACES : respecte mieux les couleurs des étiquettes.
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    const kit = await createBottleKit(r);
    return new Stage(opts, r, kit);
  }

  private constructor(
    private opts: StageOptions,
    private renderer: THREE.WebGLRenderer,
    readonly kit: BottleKit,
  ) {
    this.scene.environment = this.kit.envMap;
    this.scene.environmentIntensity = 0.5;

    // Contre-jour pour découper la silhouette + douce lumière de face.
    const rim = new THREE.DirectionalLight(0xffffff, 3.2);
    rim.position.set(-8, 12, -14);
    const rim2 = new THREE.DirectionalLight(0xfff1dc, 1.6);
    rim2.position.set(10, 4, -10);
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(4, 8, 14);
    this.scene.add(rim, rim2, key, this.group);

    this.active = new Bottle(this.kit, { bubbles: !opts.lowPower });
    this.incoming = new Bottle(this.kit, { bubbles: !opts.lowPower });
    this.incoming.root.visible = false;
    this.group.add(this.active.root, this.incoming.root);

    this.resize();
  }

  /** Échange les rôles une fois la transition terminée. */
  swap() {
    [this.active, this.incoming] = [this.incoming, this.active];
    this.incoming.root.visible = false;
  }

  async prepare(bottle: Bottle, beer: Beer) {
    // Applique tout de suite couleurs et capsule, l'étiquette dès qu'elle est prête.
    const tex = this.kit.labelTexture(beer);
    bottle.setBeer(beer, null);
    // On attend l'étiquette au plus 700 ms pour ne pas bloquer l'animation.
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 700));
    const ready = await Promise.race([tex, timeout]).catch(() => null);
    if (ready) bottle.setBeer(beer, ready);
    else tex.then((t) => bottle.setLabel(beer, t)).catch(() => {});
  }

  /** Compile les shaders sans figer la page (compilation parallèle du GPU quand elle existe). */
  async warmup() {
    this.incoming.root.visible = true; // compile aussi les matériaux de la 2e bouteille
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      this.incoming.root.visible = false;
    }
  }

  /** Précharge les étiquettes en tâche de fond. */
  preload(beers: Beer[]) {
    let i = 0;
    const next = () => {
      if (i >= beers.length) return;
      this.kit.labelTexture(beers[i++]).finally(next);
    };
    next();
  }

  /** Réglages de lumière (page de test). */
  tune(o: { env?: number; exposure?: number }) {
    if (o.env !== undefined) this.scene.environmentIntensity = o.env;
    if (o.exposure !== undefined) this.renderer.toneMappingExposure = o.exposure;
  }

  /** Position du pointeur normalisée (-1 → 1) pour l'inclinaison de la bouteille. */
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  resize() {
    const canvas = this.opts.canvas;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const portrait = aspect < 0.8;
    // part de la hauteur d'écran occupée par la bouteille
    const frac = portrait ? 0.5 : 0.72;
    const visibleH = BOTTLE_HEIGHT / frac;
    const dist = visibleH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.aspect = aspect;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    // sur mobile la bouteille remonte pour laisser la place aux infos
    this.baseY = visibleH * (portrait ? 0.1 : 0.035);
    this.exitX = (visibleH / 2) * aspect + 9;
    // pas de rendu avant warmup() : il compilerait tous les shaders d'un bloc
    if (this.started && !this.running) this.render();
  }

  start() {
    if (this.running || !this.visible) return;
    this.running = true;
    this.started = true;
    this.timer.reset(); // pas de saut après une pause
    const loop = (now: number) => {
      if (!this.running) return;
      this.timer.update(now);
      this.render();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  /** Pause quand le hero sort de l'écran ou que l'onglet est caché. */
  setVisible(v: boolean) {
    this.visible = v;
    if (v) this.start();
    else this.stop();
  }

  private render() {
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    const g = this.group;
    // flottement + inclinaison douce vers le curseur (± 8°)
    g.position.y = this.baseY + Math.sin(t * 1.1) * 0.22;
    g.rotation.y += (this.pointer.x * 0.14 - g.rotation.y) * 0.06;
    g.rotation.x += (-this.pointer.y * 0.07 - g.rotation.x) * 0.06;
    this.active.update(dt, t);
    if (this.incoming.root.visible) this.incoming.update(dt, t);
    this.renderer.render(this.scene, this.camera);
  }
}
