// Comportements communs à toutes les pages : défilement lissé (Lenis),
// en-tête, menu mobile, curseur, bannière d'âge, filtres de la gamme.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';

const AGE_KEY = 'maelstrom-age-ok';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initSite() {
  const lenis = reduced() ? null : new Lenis({ autoRaf: true, lerp: 0.11, anchors: { offset: -70 } });
  const scrollTo = (y: number | string | HTMLElement) => {
    if (lenis) lenis.scrollTo(y as number, { duration: 1.1 });
    else if (typeof y === 'number') window.scrollTo({ top: y });
    else (typeof y === 'string' ? document.querySelector(y) : y)?.scrollIntoView();
  };
  window.addEventListener('maelstrom:scroll-top', () => scrollTo(0));

  initHeader();
  initCursor();
  initAgeGate(lenis);
  initRange(scrollTo);
}

/* En-tête : fond sombre dès qu'on quitte le hero, menu mobile. */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const hero = document.querySelector('[data-carousel]');
  const update = () => {
    const limit = hero ? hero.getBoundingClientRect().bottom - 70 : 10;
    header.classList.toggle('is-scrolled', hero ? limit <= 0 : window.scrollY > 10);
  };
  update();
  window.addEventListener('scroll', update, { passive: true });

  const toggle = header.querySelector<HTMLButtonElement>('.nav-toggle');
  const setOpen = (open: boolean) => {
    header.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  header.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
}

/* Curseur : pastille à la couleur de la bière, « Glisse » sur la bouteille. */
function initCursor() {
  const cursor = document.querySelector<HTMLElement>('.cursor');
  if (!cursor || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const x = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
  const y = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x(e.clientX);
    y(e.clientY);
    const t = e.target as HTMLElement;
    const onHero = !!t.closest('[data-carousel]');
    cursor.classList.add('is-visible');
    cursor.classList.toggle('is-hero', onHero);
    cursor.classList.toggle('is-drag', t.classList.contains('hero__canvas'));
    cursor.classList.toggle('is-link', !!t.closest('a, button'));
  });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
}

/* Bannière d'âge : mémorisée en localStorage (protégé : navigation privée, etc.). */
function initAgeGate(lenis: Lenis | null) {
  const gate = document.querySelector<HTMLElement>('[data-age-gate]');
  if (!gate) return;
  let ok = false;
  try {
    ok = localStorage.getItem(AGE_KEY) === '1';
  } catch {
    /* stockage indisponible : on redemandera */
  }
  if (ok) return;
  gate.hidden = false;
  lenis?.stop();
  const yes = gate.querySelector<HTMLButtonElement>('[data-age-yes]')!;
  yes.focus();
  yes.addEventListener('click', () => {
    try {
      localStorage.setItem(AGE_KEY, '1');
    } catch {
      /* rien à faire */
    }
    gsap.to(gate, {
      autoAlpha: 0,
      duration: 0.4,
      onComplete: () => {
        gate.hidden = true;
        lenis?.start();
      },
    });
  });
  gate.querySelector('[data-age-no]')!.addEventListener('click', () => {
    gate.querySelector('[data-age-text]')!.textContent =
      'Reviens nous voir à ta majorité ! En attendant, le site reste réservé aux adultes.';
  });
}

/* Gamme : filtres + clic sur une carte = la bière s'affiche dans le carrousel. */
function initRange(scrollTo: (y: number) => void) {
  const range = document.querySelector<HTMLElement>('[data-range]');
  if (!range) return;
  const cards = [...range.querySelectorAll<HTMLElement>('[data-card]')];
  const buttons = [...range.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter!;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      const shown = cards.filter((c) =>
        f === 'all' ? true : f === 'bio' ? c.dataset.organic === 'true' : c.dataset.category === f,
      );
      cards.forEach((c) => (c.hidden = !shown.includes(c)));
      if (!reduced()) {
        gsap.fromTo(shown, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
      }
    }),
  );
  range.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-show]');
    if (!link) return;
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('maelstrom:show', { detail: link.dataset.show }));
    scrollTo(0);
  });
}
