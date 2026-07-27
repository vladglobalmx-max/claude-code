import { chromium } from '@playwright/test';

// Fase 5: genera el PDF de producción REAL del sticker VELARA (mismo diseño
// mostrado en la Hero y en las capturas de pantalla del video de lanzamiento)
// usando el propio wizard "Exportar para impresión" de THÖREN - sangrado y
// marcas de corte reales, no una aproximación - listo para enviarlo a una
// imprenta física (ver FASE5_PHYSICAL_PRODUCTION_BRIEF_v1.0.md, seccion 5).
const OUT = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/video';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
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

await page.getByRole('button', { name: /^Texto$/i }).first().click();
await page.waitForTimeout(300);
await page.locator('.layer-row').first().click();
await page.waitForTimeout(200);

const inspector = page.locator('#inspector-content');
const contentField = inspector.getByLabel('Contenido');
await contentField.waitFor({ state: 'visible', timeout: 5000 });
await contentField.fill('VELARA');
await contentField.blur();

const fontField = inspector.getByLabel('Tipografía').first();
await fontField.fill('Familjen Grotesk');
await fontField.press('Tab');

const sizeField = inspector.getByLabel('Tamaño').first();
await sizeField.fill('30');
await sizeField.press('Tab');

const colorField = inspector.locator('input[type="color"]').first();
await colorField.evaluate((el, v) => {
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, '#23282B');

await page.getByRole('button', { name: /centrar horizontal en página/i }).click();
await page.waitForTimeout(150);
await page.getByRole('button', { name: /centrar vertical en página/i }).click();
await page.waitForTimeout(150);

await page.keyboard.press('Escape');
await page.mouse.click(20, 700).catch(() => {});
await page.waitForTimeout(200);

// "Exportar para impresión" -> wizard real de produccion (Epic 9)
await page.click('#production-export-btn');
await page.waitForSelector('.production-export-dialog-overlay[style*="flex"]');
await page.waitForTimeout(300);

// El perfil "Sticker Sheet" (imposicion + sangrado + marcas de corte) viene
// preseleccionado por defecto - es exactamente lo que se necesita para
// imprimir varias copias reales en una sola hoja.
await page.click('.production-export-next'); // profile -> config
await page.waitForTimeout(200);
await page.click('.production-export-next'); // config -> preview
await page.waitForSelector('.production-preview-canvas-slot canvas', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(300);
await page.click('.production-export-next'); // preview -> preflight
await page.waitForTimeout(200);
await page.click('.production-export-body button'); // "Correr Preflight"
await page.waitForTimeout(500);

await page.click('.production-export-next'); // preflight -> warnings o auto-skip
await page.waitForTimeout(300);
const h2Text = await page.locator('.production-export-dialog h2').textContent();
if (h2Text?.trim() === 'Advertencias') {
  const acceptCheckbox = page.locator('.production-export-accept-warnings input');
  if (await acceptCheckbox.count() > 0) await acceptCheckbox.click();
  await page.click('.production-export-next');
}

await page.waitForSelector('.production-export-dialog h2:has-text("Resultado")', { timeout: 20000 });
await page.waitForTimeout(300);

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.production-export-body button', { hasText: /Descargar/i }).first().click(),
]);
await download.saveAs(`${OUT}/velara-sticker-print-ready.pdf`);
console.log('captured velara-sticker-print-ready.pdf (real production export, Sticker Sheet profile)');

await browser.close();
