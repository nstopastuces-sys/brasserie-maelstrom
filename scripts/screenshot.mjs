// Capture d'écran de contrôle avec Chromium (Playwright), WebGL compris.
// Usage : npm run shot -- <url> <fichier.png> [largeur] [hauteur] [attente ms] [script js]

import { chromium } from 'playwright';

const [url, out, w = '1440', h = '900', wait = '2500', js] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage : npm run shot -- <url> <fichier.png> [largeur] [hauteur] [attente ms] [script]');
  process.exit(1);
}

const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
  reducedMotion: process.env.REDUCED === '1' ? 'reduce' : 'no-preference',
});
  await page.addInitScript(() => { try { localStorage.setItem('maelstrom-age-ok', '1'); } catch {} });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
if (js) await page.evaluate(js);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const d = c?.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'webgl2 indisponible';
});
console.log('GPU :', gl);
if (logs.length) console.log(logs.join('\n'));
await browser.close();
