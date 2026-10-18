// Renders the composition frame by frame: node render.mjs <html> <outDir> <fps> <duration> | stills <times...>
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const [html, out, mode, ...rest] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${html}`);
await page.evaluate(() => window.ready);
const times = mode === 'stills' ? rest.map(Number) : null;
const grab = async (t, file) => { await page.evaluate((x) => window.render(x), t); await page.screenshot({ path: file, type: 'png' }); };
if (times) for (const t of times) await grab(t, `${out}/still-${t.toFixed(2)}.png`);
else {
  const fps = Number(rest[0]), total = Math.round(Number(rest[1]) * fps);
  for (let f = Number(rest[2] || 0); f < total; f++) await grab(f / fps, `${out}/f${String(f).padStart(4, '0')}.png`);
  console.log('frames', total);
}
await browser.close();
