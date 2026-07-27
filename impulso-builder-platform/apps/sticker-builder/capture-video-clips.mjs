import { chromium } from '@playwright/test';
import fs from 'node:fs';

// Fase 5 - animatic v2: grabacion continua y real de la app en ejecucion,
// cubriendo los pasos del flujo de trabajo (Escenas 3-4 del storyboard).
// v2 agrega un paso dedicado de "Organizar" (alineacion/distribucion real,
// no reutiliza el clip de diseño) y da mas margen de dwell real alrededor
// del paso de exportar/preflight para poder recortar sin que el freeze de
// relleno caiga sobre el frame equivocado (bug reportado en el animatic v1).
// Nada de esto es una interfaz simulada: es Chromium real controlando la
// app real en localhost:4174.

const OUT = '/tmp/claude-0/-home-user-claude-code/b61b8831-19e6-5860-8768-b87ff9b98d8c/scratchpad/video';
const VIDEO_DIR = `${OUT}/raw-recording-v2`;
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const marks = [];
const t0 = Date.now();
function mark(label) {
  const t = (Date.now() - t0) / 1000;
  marks.push({ label, t });
  console.log(`[${t.toFixed(2)}s] ${label}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

mark('inicio');

await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const startBtn = page.getByRole('button', { name: /comenzar/i }).first();
if (await startBtn.count() > 0) { await startBtn.click(); await page.waitForTimeout(300); }

// ---- PASO 1: crear proyecto ----
mark('paso1-crear-proyecto-inicio');
await page.getByRole('button', { name: /nuevo proyecto/i }).first().click();
await page.waitForTimeout(700);

// ---- PASO 2: elegir plantilla ----
mark('paso2-elegir-plantilla-inicio');
await page.getByText(/circular|redond/i).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /crear|continuar|siguiente/i }).first().click();
await page.waitForTimeout(1200);

// ---- PASO 3: diseñar (solo el diseño principal, VELARA) ----
mark('paso3-disenar-inicio');
async function insertText({ content, fontSize, x, y }) {
  await page.getByRole('button', { name: /^Texto$/i }).first().click();
  await page.waitForTimeout(400);
  await page.locator('.layer-row').first().click();
  await page.waitForTimeout(300);
  const inspector = page.locator('#inspector-content');
  const contentField = inspector.getByLabel('Contenido');
  await contentField.waitFor({ state: 'visible', timeout: 5000 });
  await contentField.fill(content);
  await contentField.blur();
  await page.waitForTimeout(300);
  const fontField = inspector.getByLabel('Tipografía').first();
  await fontField.fill('Familjen Grotesk');
  await fontField.press('Tab');
  await page.waitForTimeout(200);
  const sizeField = inspector.getByLabel('Tamaño').first();
  await sizeField.fill(String(fontSize));
  await sizeField.press('Tab');
  await page.waitForTimeout(300);
  const colorField = inspector.locator('input[type="color"]').first();
  await colorField.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '#23282B');
  await page.waitForTimeout(200);
  if (x !== undefined) {
    const xField = inspector.getByLabel('X').first();
    await xField.fill(String(x));
    await xField.press('Tab');
  }
  if (y !== undefined) {
    const yField = inspector.getByLabel('Y').first();
    await yField.fill(String(y));
    await yField.press('Tab');
  }
  await page.waitForTimeout(400);
}

await insertText({ content: 'VELARA', fontSize: 30 });
await page.getByRole('button', { name: /centrar horizontal en página/i }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: /centrar vertical en página/i }).click();
await page.waitForTimeout(800);
mark('paso3-disenar-fin');

// ---- PASO 3.5 (NUEVO): organizar - alineacion/distribucion real de
// varios elementos, demostracion dedicada, no reutiliza el clip de diseño.
mark('paso3b-organizar-inicio');
async function insertSquare(color, x, y, size) {
  const dataUrl = await page.evaluate((c) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 300, 300);
    return canvas.toDataURL('image/png');
  }, color);
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  await page.locator('.tool-image-input').setInputFiles({ name: `sq-${color.replace('#', '')}.png`, mimeType: 'image/png', buffer });
  await page.waitForTimeout(350);
  await page.locator('.layer-row').first().click();
  await page.waitForTimeout(250);
  const inspector = page.locator('#inspector-content');
  const ancho = inspector.getByLabel('Ancho').first();
  await ancho.fill(String(size));
  await ancho.press('Tab');
  await page.waitForTimeout(150);
  const alto = inspector.getByLabel('Alto').first();
  await alto.fill(String(size));
  await alto.press('Tab');
  await page.waitForTimeout(150);
  const xF = inspector.getByLabel('X').first();
  await xF.fill(String(x));
  await xF.press('Tab');
  await page.waitForTimeout(150);
  const yF = inspector.getByLabel('Y').first();
  await yF.fill(String(y));
  await yF.press('Tab');
  await page.waitForTimeout(250);
}

// 3 cuadros pequeños, deliberadamente desalineados/desparejos - la materia
// prima real para demostrar alinear + distribuir.
await insertSquare('#9C4E27', 5, 40, 8);
await insertSquare('#4B6673', 22, 34, 8);
await insertSquare('#C97A4F', 40, 44, 8);
await page.waitForTimeout(500);

// clic en area vacia del canvas para soltar cualquier seleccion/edicion de
// texto antes de Ctrl+A (si el foco quedara en un input, Ctrl+A
// seleccionaria texto en vez de objetos).
await page.mouse.click(120, 700).catch(() => {});
await page.waitForTimeout(200);
await page.keyboard.press('Control+a');
await page.waitForTimeout(600);

await page.getByRole('button', { name: /^Alinear arriba$/i }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /^Distribuir horizontalmente$/i }).click();
await page.waitForTimeout(900);
mark('paso3b-organizar-fin');

// deseleccionar y limpiar los 3 cuadros de la demo de organizar: son
// intencionalmente de baja resolucion y quedaron cerca del borde tras
// alinear/distribuir, lo que dispararia varias advertencias adicionales
// de Preflight (resolucion + safe area) ajenas a la que se quiere
// demostrar - cada demo debe quedar limpia y enfocada en su propio punto.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
for (let i = 0; i < 3; i++) {
  await page.locator('.layer-row').first().click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: /^Eliminar$/i }).click();
  await page.waitForTimeout(250);
}
await page.waitForTimeout(300);

// ---- preparar el problema real para Preflight (imagen a caballo del
// borde de pagina - mitad dentro, mitad fuera). Paso corto, deliberado,
// separado de "organizar" para no confundir ambas demostraciones. ----
mark('preparar-problema-preflight-inicio');
const dataUrlProblema = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9C4E27';
  ctx.fillRect(0, 0, 480, 480);
  return canvas.toDataURL('image/png');
});
const imgBuffer = Buffer.from(dataUrlProblema.split(',')[1], 'base64');
await page.locator('.tool-image-input').setInputFiles({ name: 'logo-placeholder.png', mimeType: 'image/png', buffer: imgBuffer });
await page.waitForTimeout(400);
await page.locator('.layer-row').first().click();
await page.waitForTimeout(300);
const inspectorImg = page.locator('#inspector-content');
const anchoField = inspectorImg.getByLabel('Ancho').first();
await anchoField.fill('40');
await anchoField.press('Tab');
await page.waitForTimeout(200);
const altoField = inspectorImg.getByLabel('Alto').first();
await altoField.fill('40');
await altoField.press('Tab');
await page.waitForTimeout(200);
const straddleX = -20;
const xImgField = inspectorImg.getByLabel('X').first();
await xImgField.fill(String(straddleX));
await xImgField.press('Tab');
await page.waitForTimeout(200);
const yImgField = inspectorImg.getByLabel('Y').first();
await yImgField.fill('20');
await yImgField.press('Tab');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
mark('preparar-problema-preflight-fin');

// ---- PASO 4: exportar para impresion -> preview con sangrado/marcas.
// Dwell real mas largo aqui (3.2s en vez de 1.5s) para tener margen y
// poder recortar el corte limpio ANTES del clic que abre Preflight, sin
// necesitar que el relleno (freeze) caiga sobre un frame de otro paso. ----
mark('paso4-exportar-preview-inicio');
await page.click('#production-export-btn');
await page.waitForSelector('.production-export-dialog-overlay[style*="flex"]');
await page.waitForTimeout(400);
await page.click('.production-export-next'); // profile(Sticker Sheet, default) -> config
await page.waitForTimeout(500);
await page.click('.production-export-next'); // config -> preview
await page.waitForSelector('.production-preview-canvas-slot canvas', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3200);
mark('paso4-exportar-preview-fin-limpio'); // <- frame de referencia: SIEMPRE preview, nunca preflight

// ---- PASO 5: preflight detecta un problema real (transicion real y
// continua desde el paso anterior, sin corte) ----
await page.click('.production-export-next'); // preview -> preflight
await page.waitForTimeout(300);
mark('paso5-preflight-abierto');
await page.click('.production-export-body button'); // "Correr Preflight"
await page.waitForTimeout(1800);
mark('paso5-preflight-problema-visible');

// cerrar el wizard, volver al canvas, corregir el elemento mal posicionado
await page.click('.production-export-cancel');
await page.waitForSelector('.production-export-dialog-overlay', { state: 'hidden' });
await page.waitForTimeout(400);
mark('paso5-preflight-corrigiendo-inicio');
await page.locator('.layer-row').first().click(); // la imagen quedo como capa superior
await page.waitForTimeout(300);
const inspectorFix = page.locator('#inspector-content');
const xFix = inspectorFix.getByLabel('X').first();
await xFix.fill('5');
await xFix.press('Tab');
await page.waitForTimeout(200);
const yFix = inspectorFix.getByLabel('Y').first();
await yFix.fill('5');
await yFix.press('Tab');
await page.waitForTimeout(600);
mark('paso5-preflight-corrigiendo-fin');

// reabrir el wizard y re-correr preflight -> ahora sin errores
mark('paso6-preflight-limpio-inicio');
await page.click('#production-export-btn');
await page.waitForSelector('.production-export-dialog-overlay[style*="flex"]');
await page.waitForTimeout(300);
await page.click('.production-export-next'); // profile -> config
await page.waitForTimeout(300);
await page.click('.production-export-next'); // config -> preview
await page.waitForTimeout(500);
await page.click('.production-export-next'); // preview -> preflight
await page.waitForTimeout(300);
await page.click('.production-export-body button'); // "Correr Preflight"
await page.waitForTimeout(1200);
mark('paso6-preflight-limpio-fin');

// ---- PASO 7: imposicion en hoja ----
mark('paso7-imposicion-inicio');
await page.click('.production-export-next'); // preflight -> warnings/auto-skip
await page.waitForTimeout(300);
const h2 = await page.locator('.production-export-dialog h2').textContent().catch(() => '');
if (h2?.trim() === 'Advertencias') {
  const accept = page.locator('.production-export-accept-warnings input');
  if (await accept.count() > 0) await accept.click();
}
await page.waitForTimeout(1500);
mark('paso7-imposicion-fin');

mark('fin');
fs.writeFileSync(`${OUT}/clip-marks.json`, JSON.stringify(marks, null, 2));

await context.close(); // flushes the recorded video file
await browser.close();
console.log('Grabacion continua guardada en', VIDEO_DIR);
