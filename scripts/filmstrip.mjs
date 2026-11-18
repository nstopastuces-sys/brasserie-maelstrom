// Filmstrip de contrôle d'une transition : clic sur « suivant » puis captures à intervalles.
// Usage : node scripts/filmstrip.mjs <url> <sortie.png> <largeur> <hauteur> <ms1,ms2,...> [sélecteur]
import { chromium } from 'playwright';
import sharp from 'sharp';

const [url, out, w, h, times, selector = '[data-next]'] = process.argv.slice(2);
const W = Number(w);
const H = Number(h);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.addInitScript(() => { try { localStorage.setItem('maelstrom-age-ok', '1'); } catch {} });
const logs = new Set();
page.on('pageerror', (e) => logs.add(`[pageerror] ${e.message}`));
page.on('console', (m) => m.type() === 'error' && logs.add(`[error] ${m.text()}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.mouse.move(W - 5, 5); // hors du hero : pas de pause au survol
await page.waitForTimeout(3200);
const shots = [await page.screenshot()];
// ralenti ×10 pour décomposer la transition (exposé en mode dev)
const slow = Number(process.env.SLOW || 10);
await page.evaluate((k) => { window.__gsap?.globalTimeline.timeScale(1 / k); }, slow);
await page.click(selector, { timeout: 15000 });
const start = Date.now();
for (const t of times.split(',').map((x) => Number(x) * slow)) {
  const wait = t - (Date.now() - start);
  if (wait > 0) await page.waitForTimeout(wait);
  shots.push(await page.screenshot());
}
await browser.close();
const scale = 0.5;
const sw = Math.round(W * scale);
const sh = Math.round(H * scale);
const small = await Promise.all(shots.map((s) => sharp(s).resize(sw, sh).toBuffer()));
const cols = Math.min(small.length, 4);
const rows = Math.ceil(small.length / cols);
await sharp({ create: { width: cols * sw, height: rows * sh, channels: 3, background: '#000' } })
  .composite(small.map((input, i) => ({ input, left: (i % cols) * sw, top: Math.floor(i / cols) * sh })))
  .png()
  .toFile(out);
console.log(`✓ ${out}`);
if (logs.size) console.log([...logs].join('\n'));
