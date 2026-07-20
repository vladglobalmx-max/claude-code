import { test, expect, type Page } from "@playwright/test";

/**
 * Prueba visual (no jsdom, navegador real): compara píxeles del canvas
 * INTERACTIVO del editor contra el PNG exportado, en casos representativos
 * (dos regiones de color sólido y un fondo vacío, y una escala distinta de
 * 1x). Es la condición 7 de la aprobación de "reutilizar Konva vía Stage
 * headless para PNG" (ver ADR-0012) — sin esto, la fidelidad pixel-a-pixel
 * prometida por esa decisión sería solo una afirmación, no algo verificado
 * y repetible.
 *
 * Epic 8 (Autosave, Recovery & Project Safety), sección 17: desde
 * Workspace-first (ADR-0014) la app SIEMPRE aterriza en "Mis proyectos" —
 * ya no hay forma de llegar directamente al editor con un Project
 * hardcodeado (`demoProject.ts` solo es alcanzable como fallback interno de
 * tests que no inyectan `initialProject`, nunca por navegación real). Este
 * spec ya no depende de `demoProject.ts` (que tenía un Rectangle y un
 * Ellipse, ninguno de los dos con una herramienta propia en la barra de
 * herramientas — gap preexistente, documentado en Technical Debt): en su
 * lugar crea un Project en blanco vía la experiencia soportada (Workspace →
 * "Nuevo proyecto" → Personalizado) y sube dos imágenes de color sólido
 * generadas por el propio `<canvas>` del navegador (misma técnica ya
 * probada en `multi-selection.spec.ts`), posicionadas con precisión vía los
 * campos X/Y/Ancho/Alto del Inspector. El intento de verificación original
 * (colores/fondo, 1x, 2x, fondo transparente) se preserva sin cambios.
 */

type RGBA = [number, number, number, number];

const MM_TO_PX = 96 / 25.4;

async function samplePixelsFromPngBuffer(
  page: Page,
  buffer: Buffer,
  points: readonly { x: number; y: number }[],
): Promise<RGBA[]> {
  const base64 = buffer.toString("base64");
  return page.evaluate(
    async ({ base64, points }) => {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo decodificar el PNG."));
      });
      img.src = `data:image/png;base64,${base64}`;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return points.map(({ x, y }) => Array.from(ctx.getImageData(x, y, 1, 1).data) as RGBA);
    },
    { base64, points },
  );
}

function expectCloseColor(actual: RGBA, expected: RGBA, tolerance = 6): void {
  for (let channel = 0; channel < 4; channel++) {
    expect(
      Math.abs(actual[channel] - expected[channel]),
      `canal ${channel} — actual ${JSON.stringify(actual)} vs esperado ${JSON.stringify(expected)}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

const IMAGE_A_FILL: RGBA = [0xfe, 0xf0, 0x8a, 255]; // #fef08a
const IMAGE_A_HEX = "#fef08a";
const IMAGE_B_FILL: RGBA = [0xf9, 0x73, 0x16, 255]; // #f97316
const IMAGE_B_HEX = "#f97316";
const WHITE: RGBA = [255, 255, 255, 255];

// Página Personalizada de 100x100mm (ver `openBlankProject`). Image A ocupa
// 10-40mm en ambos ejes; Image B, 60-90mm — no se superponen, y (25,25) /
// (75,75) están bien dentro de cada una (nunca sobre un borde antialiaseado).
const POINT_ON_IMAGE_A = { x: Math.round(25 * MM_TO_PX), y: Math.round(25 * MM_TO_PX) };
const POINT_ON_IMAGE_B = { x: Math.round(75 * MM_TO_PX), y: Math.round(75 * MM_TO_PX) };
const POINT_ON_BACKGROUND = { x: Math.round(5 * MM_TO_PX), y: Math.round(5 * MM_TO_PX) }; // fuera de ambas imágenes

async function openBlankProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-card-custom");
  await page.click(".new-project-card-custom");
  await page.fill(".new-project-dialog-width", "100");
  await page.fill(".new-project-dialog-height", "100");
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#export-btn");
  // Zoom a 100% exacto: a esa escala, 1 px del canvas == 1 px del
  // documento, así las coordenadas hardcodeadas de arriba aplican tal cual
  // tanto al screenshot del editor como al PNG exportado en 1x.
  await page.click('.zoom-preset:has-text("100%")');
  await page.waitForTimeout(150);
}

/** Sube un PNG de color sólido generado por el propio `<canvas>` del
 * navegador (evita construir bytes de PNG a mano en Node) y lo selecciona
 * en Capas — igual que `multi-selection.spec.ts`. */
async function uploadSolidColorImage(page: Page, color: string): Promise<void> {
  const dataUrl = await page.evaluate((fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png");
  }, color);
  const buffer = Buffer.from(dataUrl.split(",")[1]!, "base64");
  const fileInput = page.locator(".tool-image-input");
  await fileInput.setInputFiles({ name: `solid-${color.replace("#", "")}.png`, mimeType: "image/png", buffer });
  await page.waitForTimeout(150);
  // insertImage no selecciona automáticamente el object recién creado — se
  // selecciona vía su fila en Capas (la más nueva es siempre la primera).
  await page.locator(".layer-row").first().click();
}

async function setInspectorValue(page: Page, label: string, value: number): Promise<void> {
  const field = page.locator(".inspector-field").filter({ has: page.locator(`> span:text-is("${label}")`) });
  const input = field.locator("input");
  await input.fill(String(value));
  await input.press("Enter");
  await page.waitForTimeout(50);
}

async function exportPng(
  page: Page,
  options: { background: "transparent" | "solid"; color?: string; scale: 1 | 2 | 3 | 4; filename: string },
): Promise<Buffer> {
  await page.click("#export-btn");
  await page.waitForSelector(".export-dialog-export");
  await page.click('.export-dialog-format input[value="png"]');
  if (options.background === "solid") {
    await page.click('.export-dialog-background input[value="solid"]');
    await page.fill(".export-dialog-color", options.color ?? "#ffffff");
  } else {
    await page.click('.export-dialog-background input[value="transparent"]');
  }
  await page.click(`.export-dialog-scale-button[data-scale="${options.scale}"]`);
  await page.fill(".export-dialog-filename-input", options.filename);

  const [download] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
  const streamPath = await download.path();
  const buffer = streamPath ? await import("node:fs").then((fs) => fs.promises.readFile(streamPath)) : Buffer.alloc(0);

  await page.click(".export-dialog-cancel");
  return buffer;
}

test.beforeEach(async ({ page }) => {
  await openBlankProject(page);

  await uploadSolidColorImage(page, IMAGE_A_HEX);
  await setInspectorValue(page, "X", 10);
  await setInspectorValue(page, "Y", 10);
  await setInspectorValue(page, "Ancho", 30);
  await setInspectorValue(page, "Alto", 30);

  await uploadSolidColorImage(page, IMAGE_B_HEX);
  await setInspectorValue(page, "X", 60);
  await setInspectorValue(page, "Y", 60);
  await setInspectorValue(page, "Ancho", 30);
  await setInspectorValue(page, "Alto", 30);

  // Ninguna imagen debe quedar seleccionada al exportar (por si el
  // recuadro de selección afectara el screenshot del canvas interactivo).
  await page.keyboard.press("Escape");
});

test("el PNG exportado (fondo sólido blanco, 1x) coincide pixel a pixel con el canvas del editor", async ({ page }) => {
  const liveScreenshot = await page.locator("#canvas-runtime").screenshot();
  const [liveA, liveB, liveBackground] = await samplePixelsFromPngBuffer(page, liveScreenshot, [
    POINT_ON_IMAGE_A,
    POINT_ON_IMAGE_B,
    POINT_ON_BACKGROUND,
  ]);

  const exportedBuffer = await exportPng(page, { background: "solid", color: "#ffffff", scale: 1, filename: "visual-1x" });
  const [exportedA, exportedB, exportedBackground] = await samplePixelsFromPngBuffer(page, exportedBuffer, [
    POINT_ON_IMAGE_A,
    POINT_ON_IMAGE_B,
    POINT_ON_BACKGROUND,
  ]);

  expectCloseColor(liveA!, IMAGE_A_FILL);
  expectCloseColor(exportedA!, IMAGE_A_FILL);
  expectCloseColor(liveA!, exportedA!);

  expectCloseColor(liveB!, IMAGE_B_FILL);
  expectCloseColor(exportedB!, IMAGE_B_FILL);
  expectCloseColor(liveB!, exportedB!);

  expectCloseColor(liveBackground!, WHITE);
  expectCloseColor(exportedBackground!, WHITE);
  expectCloseColor(liveBackground!, exportedBackground!);
});

test("el PNG exportado a 2x reproduce los mismos colores en las coordenadas escaladas", async ({ page }) => {
  const exportedBuffer = await exportPng(page, { background: "solid", color: "#ffffff", scale: 2, filename: "visual-2x" });
  const scale = 2;
  const [a, b, background] = await samplePixelsFromPngBuffer(page, exportedBuffer, [
    { x: POINT_ON_IMAGE_A.x * scale, y: POINT_ON_IMAGE_A.y * scale },
    { x: POINT_ON_IMAGE_B.x * scale, y: POINT_ON_IMAGE_B.y * scale },
    { x: POINT_ON_BACKGROUND.x * scale, y: POINT_ON_BACKGROUND.y * scale },
  ]);

  expectCloseColor(a!, IMAGE_A_FILL);
  expectCloseColor(b!, IMAGE_B_FILL);
  expectCloseColor(background!, WHITE);
});

test("el PNG exportado con fondo transparente tiene alpha=0 fuera de toda forma", async ({ page }) => {
  const exportedBuffer = await exportPng(page, { background: "transparent", scale: 1, filename: "visual-transparent" });
  const [background] = await samplePixelsFromPngBuffer(page, exportedBuffer, [POINT_ON_BACKGROUND]);
  expect(background![3]).toBe(0);
});
