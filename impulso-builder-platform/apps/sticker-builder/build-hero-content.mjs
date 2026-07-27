import { chromium } from '@playwright/test';

const OUT = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/hero';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, acceptDownloads: true });
const page = await context.newPage();

await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const startBtn = page.getByRole('button', { name: /comenzar/i }).first();
if (await startBtn.count() > 0) { await startBtn.click(); await page.waitForTimeout(300); }

await page.getByRole('button', { name: /nuevo proyecto/i }).first().click();
await page.waitForTimeout(500);
await page.getByText(/circular|redond/i).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: /crear|continuar|siguiente/i }).first().click();
await page.waitForTimeout(1000);

async function insertAndStyle({ content, fontFamily, fontSize, color }) {
  await page.getByRole('button', { name: /^Texto$/i }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.layer-row').first().click();
  await page.waitForTimeout(200);

  const inspector = page.locator('#inspector-content');

  const contentField = inspector.getByLabel('Contenido');
  await contentField.waitFor({ state: 'visible', timeout: 5000 });
  await contentField.fill(content);
  await contentField.blur();

  const fontField = inspector.getByLabel('Tipografía').first();
  await fontField.fill(fontFamily);
  await fontField.press('Tab');

  const sizeField = inspector.getByLabel('Tamaño').first();
  await sizeField.fill(String(fontSize));
  await sizeField.press('Tab');

  const alignSelect = inspector.getByLabel('Alineación').first();
  if (await alignSelect.count() > 0) {
    await alignSelect.selectOption({ label: 'Centro' }).catch(() => {});
  }

  const colorField = inspector.locator('input[type="color"]').first();
  await colorField.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, color);

  // center the wordmark on the page, both axes, via the Alineación panel
  await page.getByRole('button', { name: /centrar horizontal en página/i }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: /centrar vertical en página/i }).click();
  await page.waitForTimeout(150);
}

// a single, minimal centered wordmark badge — clean small-brand label,
// deliberately restrained (no second line) to keep the demo design premium
await insertAndStyle({ content: 'AURELIA', fontFamily: 'Familjen Grotesk', fontSize: 30, color: '#23282B' });

// "Ajustar a pantalla" anchors the zoomed content from its pre-zoom
// top-left corner instead of re-centering, so at high multiples (400%
// for a small page like this) it visually overflows past the canvas
// viewport. A fixed, more moderate preset stays safely within frame.
await page.click('.zoom-preset:has-text("200%")');
await page.waitForTimeout(300);

// deselect so the screenshot shows the finished design, not selection handles
await page.keyboard.press('Escape');
await page.mouse.click(20, 900).catch(() => {});
await page.waitForTimeout(200);

await page.screenshot({ path: `${OUT}/raw-editor-screenshot.png` });
console.log('captured raw-editor-screenshot.png');

// export the real design as a transparent PNG via the app's actual export engine
await page.getByRole('button', { name: /^Exportar$/i }).first().click();
await page.waitForTimeout(500);
const scale4x = page.getByRole('button', { name: '4x' });
if (await scale4x.count() > 0) await scale4x.click();
const filenameField = page.locator('input').filter({ hasText: '' }).last();
await page.waitForTimeout(200);

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /^Exportar$/i }).last().click(),
]);
await download.saveAs(`${OUT}/aurelia-badge.png`);
console.log('captured aurelia-badge.png (real export)');

await browser.close();
