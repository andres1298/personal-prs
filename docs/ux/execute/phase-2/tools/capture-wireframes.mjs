// Renders the phase 2 wireframes and measures their controls in the same format as phase-1/tools/capture.mjs,
// so phase-1/tools/analyze.py can draw the thumb-reach maps. Usage: node capture-wireframes.mjs <outDir>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = process.argv[2];
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(HERE, 'wireframes.html')).href;
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844, safeTop: 47, safeBottom: 34, mmPerPx: 0.1666, q: '390' },
  { name: '360x800', width: 360, height: 800, safeTop: 0, safeBottom: 0, mmPerPx: 0.1796, q: '360' },
];
const SCREENS = {
  A1: 'A · Calculadora: resultado', A2: 'A · Calculadora: buscar',
  B1: 'B · Tabla de cargas al 75 %', B2: 'B · Tabla: detalle',
  C1: 'C · Pizarrón: escribiendo', C2: 'C · Pizarrón: resultado',
};
fs.mkdirSync(OUT, { recursive: true });
const measure = fs.readFileSync(path.join(HERE, '../../phase-1/tools/capture.mjs'), 'utf8')
  .match(/function measure\(\) \{[\s\S]*?\n\}\n/)[0];
const browser = await chromium.launch();
const manifest = [];
for (const vp of VIEWPORTS) {
  for (const [id, label] of Object.entries(SCREENS)) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${PAGE}?s=${id}&vp=${vp.q}`);
    const base = `wf-${id}_${vp.name}_light`;
    await page.screenshot({ path: path.join(OUT, `${base}.png`) });
    const data = await page.evaluate(`(${measure.replace('function measure()', 'function ()')})()`);
    fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ scenario: { id, label }, viewport: vp, mode: 'light', ...data }, null, 1));
    manifest.push({ id, label, viewport: vp.name, mode: 'light', file: `${base}.png` });
    await page.close();
  }
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
await browser.close();
console.log('done', manifest.length);
