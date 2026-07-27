import { chromium } from '@playwright/test';

const OUT = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/official-screenshots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();

await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const startBtn = page.getByRole('button', { name: /comenzar/i }).first();
if (await startBtn.count() > 0) { await startBtn.click(); await page.waitForTimeout(300); }

async function createProject(templateMatch) {
  await page.getByRole('button', { name: /nuevo proyecto/i }).first().click();
  await page.waitForTimeout(500);
  const option = page.getByText(templateMatch).first();
  if (await option.count() > 0) await option.click();
  await page.waitForTimeout(300);
  const confirm = page.getByRole('button', { name: /crear|continuar|siguiente/i }).first();
  if (await confirm.count() > 0) { await confirm.click(); await page.waitForTimeout(1000); }
}

async function styleTextObject(content, color, fontSize) {
  await page.getByRole('button', { name: /^Texto$/i }).first().click();
  await page.waitForTimeout(300);

  // insertText() does not auto-select the new object (confirmed in tools.ts
  // and documented in e2e/multi-selection.spec.ts). layersPanel.ts lists
  // objects front-to-back, so the object we just inserted is always the
  // FIRST row - select it explicitly there instead of guessing canvas
  // coordinates.
  await page.locator('.layer-row').first().click();
  await page.waitForTimeout(200);

  const contentField = page.getByLabel('Contenido');
  await contentField.waitFor({ state: 'visible', timeout: 5000 });
  await contentField.fill(content);
  await contentField.blur();

  const sizeField = page.getByLabel('Tamaño').first();
  await sizeField.fill(String(fontSize));
  await sizeField.press('Tab');

  const colorField = page.locator('input[type="color"]').first();
  await colorField.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, color);

  await page.waitForTimeout(400);
}

async function renameCurrentCardInWorkspace(newName) {
  // The workspace grid sorts descriptors by updatedAt descending
  // (workspace.ts: `descriptors.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))`),
  // so the project we just edited and navigated back from is always the
  // most recently updated one, i.e. always at index 0 - regardless of how
  // many other cards already exist.
  const renameButtons = page.locator('.workspace-card-rename');
  await renameButtons.first().waitFor({ state: 'visible', timeout: 5000 });
  await renameButtons.first().click();
  await page.waitForTimeout(200);
  const input = page.locator('.workspace-card-name-input').first();
  await input.fill(newName);
  await input.press('Enter');
  await page.waitForTimeout(400);
}

// ---------- Project 1: circular badge ----------
await createProject(/circular|redond/i);
await styleTextObject('HOLA', '#9C4E27', 42);

const misProyectosBtn = page.getByRole('button', { name: /mis proyectos/i }).first();
await misProyectosBtn.click();
await page.waitForTimeout(700);
await renameCurrentCardInWorkspace('Insignia redonda');

// ---------- Project 2: square label ----------
await createProject(/cuadrad/i);
await styleTextObject('NUEVO', '#5C6E4F', 36);
await misProyectosBtn.click();
await page.waitForTimeout(700);
await renameCurrentCardInWorkspace('Etiqueta cuadrada');

// ============ SCREENSHOT 1: Workspace ============
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/01-mis-proyectos.png` });
console.log('captured 01-mis-proyectos.png');

// Open "Insignia redonda" specifically (the more visually distinctive
// design) by scoping to its card rather than assuming button order.
const redondaCard = page.locator('.workspace-card').filter({ hasText: 'Insignia redonda' });
await redondaCard.getByRole('button', { name: /^Abrir$/i }).click();
await page.waitForTimeout(1000);

// select the text object to show a populated Inspector
await page.locator('.layer-row').first().click();
await page.getByLabel('Contenido').waitFor({ state: 'visible', timeout: 5000 });
await page.waitForTimeout(300);

// frame the design so it fills the canvas viewport instead of sitting
// tiny in a mostly-empty gray area at the default 100% zoom
await page.getByRole('button', { name: /ajustar a pantalla/i }).click();
await page.waitForTimeout(300);

// ============ SCREENSHOT 2: Editor ============
await page.screenshot({ path: `${OUT}/02-editor.png` });
console.log('captured 02-editor.png');

// ============ SCREENSHOT 3: Quick export dialog ============
const exportBtn = page.getByRole('button', { name: /^Exportar$/i }).first();
await exportBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/03-exportar-rapido.png` });
console.log('captured 03-exportar-rapido.png');

const cancelBtn = page.getByRole('button', { name: /^Cancelar$/i }).first();
if (await cancelBtn.count() > 0) {
  await cancelBtn.click();
  await page.waitForTimeout(400);
}

// ============ SCREENSHOT 4: Print export wizard ============
const printExportBtn = page.getByRole('button', { name: /exportar para impresión/i }).first();
await printExportBtn.click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/04-exportar-impresion-perfil.png` });
console.log('captured 04-exportar-impresion-perfil.png');

await browser.close();
