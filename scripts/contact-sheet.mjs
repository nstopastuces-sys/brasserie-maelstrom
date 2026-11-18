// Planche contact de contrôle : capture plusieurs URL et les assemble en une image.
// Usage : node scripts/contact-sheet.mjs <sortie.png> <largeur> <hauteur> <attente> <url1> <url2> ...

import { chromium } from 'playwright';
import sharp from 'sharp';

const [out, w, h, wait, ...urls] = process.argv.slice(2);
const W = Number(w);
const H = Number(h);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const shots = [];
const logs = new Set();
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => logs.add(`[pageerror] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && logs.add(`[error] ${m.text()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(Number(wait));
  shots.push(await page.screenshot());
  await page.close();
}
await browser.close();
const cols = Math.min(urls.length, 4);
const rows = Math.ceil(urls.length / cols);
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#000' } })
  .composite(shots.map((input, i) => ({ input, left: (i % cols) * W, top: Math.floor(i / cols) * H })))
  .png()
  .toFile(out);
console.log(`✓ ${out}`);
if (logs.size) console.log([...logs].join('\n'));
