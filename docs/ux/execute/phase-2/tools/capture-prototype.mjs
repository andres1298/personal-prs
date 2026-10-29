// Captures the high-fidelity prototype (../prototype.html, wrapped in a document skeleton) and measures its controls
// in the phase 1 format, so phase-1/tools/analyze.py can draw the thumb-reach maps.
// Usage: node capture-prototype.mjs <wrapped prototype .html> <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const [, , FILE, OUT] = process.argv;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, safeTop: 47, safeBottom: 34, mmPerPx: 0.1666 },
  { name: '360x800', width: 360, height: 800, safeTop: 0, safeBottom: 0, mmPerPx: 0.1796 },
];
const SCREENS = [
  ['hf-A1', 'A · Barra', 'p=a'], ['hf-A2', 'A · Barra: buscar', 'p=a&sheet=search&q=bs%2075'],
  ['hf-B1', 'B · Tabla de cargas', 'p=b'], ['hf-B2', 'B · Tabla: detalle', 'p=b&sheet=detail'],
  ['hf-C1', 'C · Pizarrón', 'p=c'], ['hf-A3', 'A · Calentamiento', 'p=a&sheet=warm'],
];
const measure = fs.readFileSync(path.join(HERE, '../../phase-1/tools/capture.mjs'), 'utf8').match(/function measure\(\) \{[\s\S]*?\n\}\n/)[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const manifest = [];
for (const vp of VIEWPORTS) {
  for (const mode of ['light', 'dark']) {
    for (const [id, label, query] of SCREENS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: mode });
      await page.goto(`file://${FILE}?shot=1&top=${vp.safeTop}&bottom=${vp.safeBottom}&${query}`);
      await page.waitForTimeout(700);
      const base = `${id}_${vp.name}_${mode}`;
      await page.screenshot({ path: path.join(OUT, `${base}.png`) });
      const data = await page.evaluate(`(${measure.replace('function measure()', 'function ()')})()`);
      fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ scenario: { id, label }, viewport: vp, mode, ...data }, null, 1));
      manifest.push({ id, label, viewport: vp.name, mode, file: `${base}.png` });
      await page.close();
    }
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
await browser.close();
console.log('done', manifest.length);
