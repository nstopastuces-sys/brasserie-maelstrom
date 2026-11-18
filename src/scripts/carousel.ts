// Carrousel hero de la page d'accueil.
//
// Séquence de transition (≈ 1,1 s, timeline GSAP unique) :
//  1. la bouteille active pivote de 90° et sort en s'inclinant ;
//  2. une vague de mousse puis de bière monte avec la couleur suivante ;
//  3. le nom géant sort lettre par lettre vers le haut, le nouveau entre par le bas ;
//  4. les ingrédients s'éparpillent, les nouveaux apparaissent ;
//  5. la nouvelle bouteille entre par le côté, fait un demi-tour et se pose (back.out) ;
//  6. style, gamme et accroche apparaissent en fondu décalé.
//
// Jamais deux transitions en même temps : une demande pendant l'animation
// est mise en file d'attente (seule la dernière est conservée).

import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';
import type { Beer, Ingredient } from '../data/types';
import { RANGE_LABEL } from '../data/types';
import { layoutName } from './name-fit';
import type { Stage } from './stage';

gsap.registerPlugin(SplitText);

// En développement : accès à GSAP depuis la console (ralenti des transitions, etc.).
if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap;

type Dir = 1 | -1;

const AUTOPLAY_DELAY = 6; // secondes

/** Emplacements des ingrédients (en % du hero) : autour de la bouteille,
 *  hors des zones de texte. d = profondeur de parallaxe. */
const SLOTS = [
  { x: 15, y: 25, s: 1.0, d: 0.9 },
  { x: 83, y: 22, s: 0.85, d: 0.6 },
  { x: 28, y: 50, s: 0.62, d: 1.3 },
  { x: 71, y: 49, s: 1.1, d: 0.5 },
  { x: 37, y: 15, s: 0.5, d: 1.6 },
  { x: 90, y: 45, s: 0.55, d: 1.2 },
  { x: 62, y: 16, s: 0.45, d: 1.8 },
];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pad = (n: number) => String(n).padStart(2, '0');

/** Petit générateur pseudo-aléatoire déterministe (même composition à chaque visite). */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

interface NameEl {
  el: HTMLElement;
  split: SplitText | null;
}

export function initCarousel(root: HTMLElement) {
  return new Carousel(root);
}

class Carousel {
  private beers: Beer[];
  private fg: string[];
  private index = 0;
  private busy = false;
  private queued: number | null = null;
  private stage: Stage | null = null;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private motion = !this.reduced;

  // autoplay
  private autoplay: gsap.core.Tween | null = null;
  private progress = { p: 0 };
  private userStopped = false;
  private hovering = false;
  private focused = false;
  private offscreen = false;

  // éléments
  private nameWrap: HTMLElement;
  private name: NameEl;
  private ingWrap: HTMLElement;
  private canvas: HTMLCanvasElement;
  private fallback: HTMLElement;
  private info: HTMLElement;
  private dots: HTMLButtonElement[];
  private live: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private foam: HTMLElement;
  private fill: HTMLElement;
  private measureCtx = document.createElement('canvas').getContext('2d')!;
  private wheelLock = 0;

  constructor(private root: HTMLElement) {
    const q = <T extends Element>(s: string) => root.querySelector<T>(s)!;
    this.beers = JSON.parse(q<HTMLScriptElement>('[data-beers]').textContent || '[]');
    this.fg = JSON.parse(q<HTMLScriptElement>('[data-fg]').textContent || '[]');
    this.nameWrap = q('.hero__name');
    this.name = { el: q('.name'), split: null };
    this.ingWrap = q('.hero__ingredients');
    this.canvas = q('.hero__canvas');
    this.fallback = q('.hero__fallback');
    this.info = q('[data-info]');
    this.dots = [...root.querySelectorAll<HTMLButtonElement>('.dot')];
    this.live = q('[data-live]');
    this.pauseBtn = q('[data-pause]');
    this.foam = q('.wave-layer--foam');
    this.fill = q('.wave-layer--fill');

    // Bière demandée dans l'URL (/#pachamama)
    const fromHash = this.indexOfSlug(location.hash.slice(1));
    if (fromHash >= 0) this.index = fromHash;

    // Animations réduites : pas de défilement automatique (relançable via le bouton).
    if (this.reduced) this.userStopped = true;

    this.renderStatic(this.index);
    this.bind();
    this.resetWave();

    // Le nom géant est remesuré une fois la police Anton chargée.
    document.fonts.load('400 100px Anton').then(() => this.relayoutName());

    // Three.js est chargé après le premier affichage (bon LCP).
    const boot = () => this.init3D();
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 600 });
    else setTimeout(boot, 200);

    this.startAutoplay();
  }

  /* ------------------------------------------------------------------ */
  /* Rendu                                                               */
  /* ------------------------------------------------------------------ */

  private indexOfSlug(slug: string) {
    return this.beers.findIndex((b) => b.slug === slug);
  }

  private wrap(i: number) {
    const n = this.beers.length;
    return ((i % n) + n) % n;
  }

  /** Affiche une bière sans animation (premier rendu, lien direct). */
  private renderStatic(i: number) {
    const beer = this.beers[i];
    this.root.style.backgroundColor = beer.color;
    this.applyColors(i, false);
    this.name.split?.revert();
    this.name.el.remove();
    this.name = this.buildName(beer);
    this.ingWrap.replaceChildren(...this.buildIngredients(beer));
    this.renderInfo(beer, i);
    this.updateDots(i);
    const img = this.fallback.querySelector('img');
    if (img) img.src = beer.label;
  }

  /** Couleurs globales (en-tête, boutons, curseur, crêtes). */
  private applyColors(i: number, animate: boolean, delay = 0) {
    const beer = this.beers[i];
    const vars = {
      '--beer': beer.color,
      '--deep': beer.colorDeep,
      '--accent': beer.accent,
      '--fg': this.fg[i],
    };
    const html = document.documentElement;
    if (animate) gsap.to(html, { ...vars, duration: 0.6, delay, ease: 'power2.inOut' });
    else gsap.set(html, vars);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', beer.color);
  }

  private measure = (text: string) => {
    this.measureCtx.font = '400 100px Anton';
    return this.measureCtx.measureText(text).width / 100;
  };

  private buildName(beer: Beer): NameEl {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const portrait = w / h < 0.8;
    // en portrait, le nom occupe le haut de l'écran au-dessus des infos
    const { lines, size } = portrait
      ? layoutName(beer.name, w, h * 0.42, this.measure, 0.42)
      : layoutName(beer.name, w, h * 0.82, this.measure);
    const el = document.createElement('div');
    el.className = 'name';
    el.style.color = beer.colorDeep;
    el.style.fontSize = `${size}px`;
    el.innerHTML = lines.map((l) => `<span class="name__line">${esc(l)}</span>`).join('');
    this.nameWrap.append(el);
    return { el, split: null };
  }

  private relayoutName() {
    const beer = this.beers[this.index];
    if (this.busy) return;
    this.name.split?.revert();
    this.name.el.remove();
    this.name = this.buildName(beer);
  }

  private splitName(n: NameEl) {
    if (!n.split) n.split = SplitText.create(n.el.querySelectorAll('.name__line'), { type: 'chars', aria: 'none' });
    return n.split.chars;
  }

  private buildIngredients(beer: Beer): HTMLElement[] {
    const rand = seeded(beer.slug);
    const small = this.root.clientWidth < 720;
    const slots = small ? SLOTS.slice(0, 4) : SLOTS;
    const list: Ingredient[] = beer.ingredients.length ? beer.ingredients : ['hop'];
    // aplat clair et trait foncé, dérivés de la couleur de la bière
    const fill = `color-mix(in srgb, ${beer.color} 45%, #fff8ea)`;
    const stroke = `color-mix(in srgb, ${beer.colorDeep} 75%, #000)`;
    return slots.map((slot, i) => {
      const kind = list[i % list.length];
      const el = document.createElement('div');
      el.className = 'ing';
      const base = small ? 70 : Math.min(150, this.root.clientWidth * 0.085);
      el.style.cssText =
        `left:${slot.x + (rand() - 0.5) * 4}%;top:${slot.y + (rand() - 0.5) * 4}%;` +
        `--size:${(base * slot.s).toFixed(0)}px;--d:${slot.d};--r:${((rand() - 0.5) * 70).toFixed(0)}deg;` +
        `--delay:${(-rand() * 6).toFixed(2)}s;--ing-fill:${fill};--ing-stroke:${stroke}`;
      el.innerHTML = `<div class="ing__anim"><svg viewBox="0 0 100 100"><use href="#ing-${kind}"></use></svg></div>`;
      return el;
    });
  }

  private renderInfo(beer: Beer, i: number) {
    const tags = [...beer.formats, RANGE_LABEL[beer.range]];
    if (beer.abv) tags.unshift(`${String(beer.abv).replace('.', ',')} % vol.`);
    this.info.innerHTML = `
      <p class="info__count" data-reveal><span>${pad(i + 1)}</span> / ${pad(this.beers.length)}</p>
      <h2 class="info__style" data-reveal><span class="sr-only">${esc(beer.name)}, </span>${esc(beer.style)}</h2>
      <ul class="info__tags" data-reveal>${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <p class="info__tagline" data-reveal>${esc(beer.tagline)}</p>
      <div class="info__actions" data-reveal>
        <a class="btn info__cta" href="#la-gamme" data-discover>Découvrir
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a class="info__link" href="#pros">Demander un tarif</a>
      </div>`;
  }

  private updateDots(i: number) {
    this.dots.forEach((d, k) => {
      if (k === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
      d.style.removeProperty('--p');
    });
  }

  /* ------------------------------------------------------------------ */
  /* Vague de mousse                                                     */
  /* ------------------------------------------------------------------ */

  private crest = 120;

  private resetWave() {
    const h = this.root.clientHeight;
    this.crest = Math.round(Math.min(160, Math.max(80, h * 0.14)));
    this.root.style.setProperty('--crest', `${this.crest}px`);
    gsap.set([this.foam, this.fill], { y: h + this.crest + 20 });
  }

  /** Bord supérieur : bulles de mousse (couche crème) ou ondulation (couche bière). */
  private crestPath(kind: 'foam' | 'fill', w: number, h: number, t: number): string {
    const base = h * 0.62;
    if (kind === 'fill') {
      const pts: string[] = [];
      const n = 36;
      for (let k = 0; k <= n; k++) {
        const x = (k / n) * w;
        const y = base + Math.sin(k * 0.55 + t * 9) * h * 0.14 + Math.sin(k * 0.21 - t * 5) * h * 0.1;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
    }
    // mousse : une suite d'arcs de tailles variées + quelques bulles détachées
    const rand = seeded('foam');
    let x = -10;
    let d = `M-10,${h} L-10,${base}`;
    while (x < w + 10) {
      const r = 10 + rand() * 26;
      const y = base + Math.sin(x * 0.012 + t * 7) * h * 0.12;
      d += ` L${x.toFixed(1)},${y.toFixed(1)} a${r.toFixed(1)},${(r * 0.9).toFixed(1)} 0 0 1 ${(2 * r).toFixed(1)},0`;
      x += 2 * r - 4;
    }
    d += ` L${w + 10},${h} Z`;
    for (let k = 0; k < 14; k++) {
      const bx = rand() * w;
      const by = base - 18 - rand() * h * 0.4 + Math.sin(t * 6 + k) * 6;
      const br = 3 + rand() * 8;
      d += ` M${(bx - br).toFixed(1)},${by.toFixed(1)} a${br.toFixed(1)},${br.toFixed(1)} 0 1 0 ${(2 * br).toFixed(1)},0 a${br.toFixed(1)},${br.toFixed(1)} 0 1 0 ${(-2 * br).toFixed(1)},0`;
    }
    return d;
  }

  private waveTimeline(to: Beer): gsap.core.Timeline {
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const c = this.crest;
    const foamPath = this.foam.querySelector('path')!;
    const fillPath = this.fill.querySelector('path')!;
    for (const layer of [this.foam, this.fill]) {
      layer.querySelector('svg')!.setAttribute('viewBox', `0 0 ${w} ${c}`);
    }
    (this.fill.querySelector('.wave-body') as HTMLElement).style.background = to.color;
    fillPath.setAttribute('fill', to.color);
    const state = { t: 0 };
    const draw = () => {
      foamPath.setAttribute('d', this.crestPath('foam', w, c, state.t));
      fillPath.setAttribute('d', this.crestPath('fill', w, c, state.t));
    };
    draw();
    const tl = gsap.timeline();
    tl.fromTo(this.foam, { y: h + 20 }, { y: -c - 10, duration: 0.86, ease: 'power2.inOut' }, 0);
    tl.fromTo(this.fill, { y: h + 20 + c * 0.5 }, { y: -c - 10, duration: 0.86, ease: 'power2.inOut' }, 0.1);
    tl.to(state, { t: 1, duration: 0.96, ease: 'none', onUpdate: draw }, 0);
    tl.call(() => {
      this.root.style.backgroundColor = to.color;
      gsap.set([this.foam, this.fill], { y: h + c + 20 });
    });
    return tl;
  }

  /* ------------------------------------------------------------------ */
  /* Transition                                                          */
  /* ------------------------------------------------------------------ */

  next() {
    this.go(this.wrap(this.index + 1), 1);
  }

  prev() {
    this.go(this.wrap(this.index - 1), -1);
  }

  async go(target: number, dir?: Dir) {
    target = this.wrap(target);
    if (target === this.index && !this.busy) return;
    if (this.busy) {
      this.queued = target;
      return;
    }
    this.busy = true;
    this.autoplay?.kill();
    const from = this.index;
    const d: Dir = dir ?? (target > from ? 1 : -1);
    const beer = this.beers[target];
    this.index = target;

    history.replaceState(null, '', `#${beer.slug}`);
    this.live.textContent = `Bière ${target + 1} sur ${this.beers.length} : ${beer.name}, ${beer.style}.`;
    this.updateDots(target);

    const stage = this.stage;
    if (stage) await stage.prepare(stage.incoming, beer);

    const tl = this.motion ? this.fullTransition(beer, target, d, stage) : this.fadeTransition(beer, target);
    tl.eventCallback('onComplete', () => this.onTransitionEnd(this.motion ? stage : null));
  }

  private onTransitionEnd(stage: Stage | null) {
    if (stage) {
      const old = stage.active;
      stage.swap();
      old.root.position.set(0, 0, 0);
      old.root.rotation.set(0, 0, 0);
      gsap.to(stage.active, { idle: 1, duration: 1.4, ease: 'power1.inOut' });
    }
    this.busy = false;
    if (this.queued !== null) {
      const q = this.queued;
      this.queued = null;
      if (q !== this.index) {
        this.go(q, q === this.wrap(this.index - 1) ? -1 : 1);
        return;
      }
    }
    this.startAutoplay();
  }

  private fullTransition(beer: Beer, i: number, dir: Dir, stage: Stage | null): gsap.core.Timeline {
    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });

    // 2. vague de mousse + couleurs globales
    tl.add(this.waveTimeline(beer), 0);
    this.applyColors(i, true, 0.25);

    // 3. nom géant lettre par lettre
    const oldName = this.name;
    const oldChars = this.splitName(oldName);
    tl.to(oldChars, { yPercent: -112, duration: 0.42, stagger: 0.014, ease: 'power3.in' }, 0);
    tl.call(() => {
      oldName.split?.revert();
      oldName.el.remove();
    }, [], 0.75);
    const newName = this.buildName(beer);
    const newChars = this.splitName(newName);
    gsap.set(newChars, { yPercent: 112 });
    tl.to(newChars, { yPercent: 0, duration: 0.85, stagger: 0.026, ease: 'expo.out' }, 0.44);
    this.name = newName;

    // 4. ingrédients : éparpillement puis apparition
    const oldIngs = [...this.ingWrap.children] as HTMLElement[];
    oldIngs.forEach((el) => {
      const a = el.querySelector('.ing__anim');
      const angle = Math.random() * Math.PI * 2;
      tl.to(a, {
        x: Math.cos(angle) * 160 - dir * 120,
        y: Math.sin(angle) * 120 - 60,
        rotation: (Math.random() - 0.5) * 220,
        scale: 0.5,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'power2.in',
      }, Math.random() * 0.12);
    });
    tl.call(() => oldIngs.forEach((el) => el.remove()), [], 0.75);
    const newIngs = this.buildIngredients(beer);
    this.ingWrap.append(...newIngs);
    const anims = newIngs.map((el) => el.querySelector('.ing__anim'));
    gsap.set(anims, { autoAlpha: 0, scale: 0.3, rotation: -60 * dir });
    tl.to(anims, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.9, stagger: 0.05, ease: 'back.out(1.7)' }, 0.45);

    // 1 + 5. bouteilles
    if (stage) {
      const { active: a, incoming: b, exitX: X } = stage;
      tl.to(a, { idle: 0, duration: 0.25 }, 0);
      tl.to(a.root.rotation, { y: `+=${(dir * Math.PI) / 2}`, z: dir * 0.55, duration: 0.7, ease: 'power3.in' }, 0);
      tl.to(a.root.position, { x: -dir * X, y: -4, duration: 0.7, ease: 'power3.in' }, 0);
      b.idle = 0;
      b.root.visible = true;
      b.root.position.set(dir * X, 3, 0);
      b.root.rotation.set(0, -dir * Math.PI, -dir * 0.4);
      tl.to(b.root.position, { x: 0, y: 0, duration: 0.9, ease: 'back.out(1.3)' }, 0.32);
      tl.to(b.root.rotation, { y: 0, z: 0, duration: 0.95, ease: 'power3.out' }, 0.32);
    } else {
      tl.add(this.fallbackSwap(beer, dir), 0.2);
    }

    // 6. infos
    const oldInfo = this.info.querySelectorAll('[data-reveal]');
    tl.to(oldInfo, { autoAlpha: 0, y: -12, duration: 0.28, stagger: 0.03, ease: 'power2.in' }, 0);
    tl.call(() => {
      this.renderInfo(beer, i);
      gsap.fromTo(
        this.info.querySelectorAll('[data-reveal]'),
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out' },
      );
    }, [], 0.62);

    return tl;
  }

  /** Animations réduites : fondus de couleur simples, pas de rotation ni de vague. */
  private fadeTransition(beer: Beer, i: number): gsap.core.Timeline {
    const tl = gsap.timeline();
    const layers = () => [this.name.el, this.info, this.ingWrap, this.fallback];
    tl.to(layers(), { autoAlpha: 0, duration: 0.25, ease: 'power1.out' }, 0);
    tl.to(this.root, { backgroundColor: beer.color, duration: 0.5, ease: 'power1.inOut' }, 0);
    this.applyColors(i, true);
    tl.call(() => {
      this.name.el.remove();
      this.name = this.buildName(beer);
      this.ingWrap.replaceChildren(...this.buildIngredients(beer));
      this.renderInfo(beer, i);
      const img = this.fallback.querySelector('img');
      if (img) img.src = beer.label;
      gsap.fromTo(layers(), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power1.out' });
    }, [], 0.27);
    tl.to({}, { duration: 0.35 });
    return tl;
  }

  /** Repli 2D : l'étiquette glisse et pivote comme une carte. */
  private fallbackSwap(beer: Beer, dir: Dir): gsap.core.Timeline {
    const tl = gsap.timeline();
    const old = this.fallback.querySelector('img');
    const img = new Image();
    img.src = beer.label;
    img.alt = '';
    img.width = 1024;
    img.height = 637;
    this.fallback.append(img);
    if (old) {
      tl.to(old, { xPercent: -dir * 140, rotation: -dir * 25, autoAlpha: 0, duration: 0.6, ease: 'power3.in' }, 0);
      tl.call(() => old.remove(), [], 0.6);
    }
    tl.fromTo(img, { xPercent: dir * 140, rotation: dir * 25, autoAlpha: 0 }, { xPercent: 0, rotation: -4, autoAlpha: 1, duration: 0.9, ease: 'back.out(1.3)' }, 0.25);
    return tl;
  }

  /* ------------------------------------------------------------------ */
  /* 3D                                                                  */
  /* ------------------------------------------------------------------ */

  private async init3D() {
    if (this.reduced || !webglAvailable()) {
      this.root.classList.add('is-fallback');
      return;
    }
    try {
      const { Stage } = await import('./stage');
      const lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
      const stage = new Stage({ canvas: this.canvas, lowPower });
      await stage.prepare(stage.active, this.beers[this.index]);
      this.stage = stage;
      // entrée de la première bouteille : elle monte en tournant
      const a = stage.active;
      a.idle = 0;
      a.root.position.y = -34;
      a.root.rotation.y = -Math.PI * 2;
      stage.start();
      this.canvas.classList.add('is-ready');
      gsap.to(a.root.position, { y: 0, duration: 1.6, ease: 'expo.out' });
      gsap.to(a.root.rotation, { y: 0, duration: 1.9, ease: 'expo.out' });
      gsap.to(a, { idle: 1, duration: 1.5, delay: 1.2 });
      stage.preload([...this.beers.slice(this.index + 1), ...this.beers.slice(0, this.index)]);
      this.observeVisibility();
    } catch (err) {
      console.warn('3D indisponible, repli 2D', err);
      this.root.classList.add('is-fallback');
    }
  }

  private observeVisibility() {
    const io = new IntersectionObserver(([entry]) => {
      this.offscreen = !entry.isIntersecting;
      this.stage?.setVisible(!this.offscreen && !document.hidden);
      this.syncAutoplay();
    });
    io.observe(this.root);
  }

  /* ------------------------------------------------------------------ */
  /* Autoplay                                                            */
  /* ------------------------------------------------------------------ */

  private startAutoplay() {
    this.autoplay?.kill();
    this.progress.p = 0;
    const dot = this.dots[this.index];
    this.autoplay = gsap.to(this.progress, {
      p: 1,
      duration: AUTOPLAY_DELAY,
      ease: 'none',
      onUpdate: () => dot?.style.setProperty('--p', this.progress.p.toFixed(3)),
      onComplete: () => this.next(),
    });
    this.syncAutoplay();
  }

  private syncAutoplay() {
    const paused = this.userStopped || this.hovering || this.focused || this.offscreen || document.hidden;
    if (this.autoplay) {
      if (paused) this.autoplay.pause();
      else if (!this.busy) this.autoplay.resume();
    }
    const stopped = this.userStopped;
    this.pauseBtn.setAttribute('aria-pressed', String(stopped));
    this.pauseBtn.querySelector('[data-pause-label]')!.textContent = stopped
      ? 'Relancer le défilement automatique'
      : 'Mettre en pause le défilement';
    if (stopped) this.dots[this.index]?.style.removeProperty('--p');
  }

  /** Première interaction : le défilement automatique s'arrête. */
  private interact() {
    if (!this.userStopped) {
      this.userStopped = true;
      this.syncAutoplay();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interactions                                                        */
  /* ------------------------------------------------------------------ */

  private bind() {
    const r = this.root;
    r.querySelector('[data-next]')!.addEventListener('click', () => {
      this.interact();
      this.next();
    });
    r.querySelector('[data-prev]')!.addEventListener('click', () => {
      this.interact();
      this.prev();
    });
    this.dots.forEach((d, i) =>
      d.addEventListener('click', () => {
        this.interact();
        this.go(i);
      }),
    );
    this.pauseBtn.addEventListener('click', () => {
      this.userStopped = !this.userStopped;
      if (!this.userStopped) this.startAutoplay();
      else this.syncAutoplay();
    });

    // Clavier : flèches gauche / droite quand le hero est à l'écran.
    document.addEventListener('keydown', (e) => {
      if (this.offscreen || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight') {
        this.interact();
        this.next();
      } else if (e.key === 'ArrowLeft') {
        this.interact();
        this.prev();
      }
    });

    // Molette : un cran = une bière (geste horizontal du trackpad ou Maj + molette).
    // La molette verticale seule fait défiler la page, pour ne pas piéger le visiteur.
    r.addEventListener(
      'wheel',
      (e) => {
        const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
        if (Math.abs(dx) < 8) return;
        e.preventDefault();
        const now = performance.now();
        if (now < this.wheelLock) return;
        this.wheelLock = now + 900; // anti-rebond (inertie des trackpads)
        this.interact();
        dx > 0 ? this.next() : this.prev();
      },
      { passive: false },
    );

    // Glisser (souris ou doigt) : la bouteille suit le geste.
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let pointerId = -1;
    let startRot = 0;
    r.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('a, button') || e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startRot = this.stage?.active.root.rotation.y ?? 0;
    });
    r.addEventListener('pointermove', (e) => {
      // inclinaison vers le curseur + parallaxe des ingrédients
      const rect = r.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      if (e.pointerType === 'mouse') {
        this.stage?.setPointer(nx, ny);
        this.ingWrap.style.setProperty('--px', nx.toFixed(3));
        this.ingWrap.style.setProperty('--py', ny.toFixed(3));
      }
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6 && !r.classList.contains('is-dragging')) {
        r.classList.add('is-dragging');
        r.setPointerCapture(pointerId);
      }
      if (this.stage && !this.busy) {
        this.stage.active.root.rotation.y = startRot + (dx / rect.width) * Math.PI * 1.4;
      }
    });
    const end = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      r.classList.remove('is-dragging');
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const threshold = Math.max(50, r.clientWidth * 0.06);
      if (e.type === 'pointerup' && Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        this.interact();
        dx < 0 ? this.next() : this.prev();
      } else if (this.stage && !this.busy) {
        gsap.to(this.stage.active.root.rotation, { y: 0, duration: 0.9, ease: 'elastic.out(1, 0.55)' });
      }
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', end);

    // Pause au survol et au focus.
    r.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.hovering = true;
      this.syncAutoplay();
    });
    r.addEventListener('pointerleave', (e) => {
      this.hovering = false;
      this.stage?.setPointer(0, 0);
      this.ingWrap.style.setProperty('--px', '0');
      this.ingWrap.style.setProperty('--py', '0');
      if (e.pointerType === 'mouse') this.syncAutoplay();
    });
    r.addEventListener('focusin', () => {
      this.focused = true;
      this.syncAutoplay();
    });
    r.addEventListener('focusout', (e) => {
      if (r.contains(e.relatedTarget as Node)) return;
      this.focused = false;
      this.syncAutoplay();
    });

    document.addEventListener('visibilitychange', () => {
      this.stage?.setVisible(!document.hidden && !this.offscreen);
      this.syncAutoplay();
    });

    window.addEventListener('maelstrom:show', (e) => {
      const i = this.indexOfSlug((e as CustomEvent<string>).detail);
      if (i < 0) return;
      this.interact();
      if (i !== this.index) this.go(i);
    });

    // Lien partagé ou carte de la gamme (#slug) : on affiche la bière et on remonte.
    window.addEventListener('hashchange', () => {
      const i = this.indexOfSlug(location.hash.slice(1));
      if (i < 0) return;
      window.dispatchEvent(new CustomEvent('maelstrom:scroll-top'));
      this.interact();
      if (i !== this.index) this.go(i);
    });

    // Redimensionnement : canvas, nom géant, vague.
    let raf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        this.stage?.resize();
        this.resetWave();
        this.relayoutName();
      });
    }).observe(r);
  }
}
