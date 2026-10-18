// Captures real app states from demo mode for the brag video.
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
const out = process.argv[2];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, colorScheme: 'dark', isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  localStorage.setItem('prs_tour_demo', JSON.stringify({ seen: true }));
});
const page = await ctx.newPage();
const font = `:root{--font: Inter, sans-serif !important; --font-rounded: "Inter Display", Inter, sans-serif !important}
*{caret-color:transparent!important} .banner{display:none!important} nextjs-portal{display:none!important}`;
await page.goto('http://localhost:3123/?demo=1', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: font });
await page.waitForTimeout(800);
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${out}/${name}.png` }); console.log(name); };
await shot('01-picker');
await page.getByRole('button', { name: /Squats/ }).click();
await shot('02-moves');
await page.getByRole('button', { name: /Back Squat/ }).click();
await shot('03-editor');
for (const pct of [75, 80, 85]) { await page.getByRole('button', { name: '+5', exact: true }).click(); await shot(`03-editor-${pct}`); }
await page.getByRole('button', { name: 'Listo' }).click();
await shot('04-bench');
await page.getByRole('radio', { name: 'Calentamiento' }).or(page.getByRole('button', { name: 'Calentamiento' })).first().click();
await shot('06-warmup');
await page.locator('.step').nth(0).click(); await page.locator('.step').nth(1).click();
await shot('07-warmup-done');
await page.locator('nav, .tab-bar').getByText('PRs').first().click();
await shot('08-prs');
await page.getByRole('button', { name: /Back Squat/ }).first().click();
await page.waitForTimeout(1200);
await shot('09-detail');
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.locator('nav, .tab-bar').getByText('Timer').first().click();
await shot('10-timer');
await page.getByRole('button', { name: /AMRAP/ }).first().click();
await shot('11-amrap');
await browser.close();
