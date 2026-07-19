import { test, expect, type Page } from "@playwright/test";

/**
 * Prueba visual (no jsdom, navegador real): compara píxeles del canvas
 * INTERACTIVO del editor contra el PNG exportado, en casos representativos
 * (relleno sólido de un rectángulo, relleno de una ellipse, fondo vacío,
 * y una escala distinta de 1x). Es la condición 7 de la aprobación de
 * "reutilizar Konva vía Stage headless para PNG" (ver ADR-0012) — sin
 * esto, la fidelidad pixel-a-pixel prometida por esa decisión sería solo
 * una afirmación, no algo verificado y repetible.
 *
 * Usa el Project de demostración (`demoProject.ts`): rectángulo #fef08a
 * (20,20 280x280), ellipse #f97316 centrada en (160,160) r=100, y texto
 * "Impulso" — coordenadas y colores hardcodeados a propósito porque son
 * parte del contrato de este test (si `demoProject.ts` cambia, este test
 * debe actualizarse junto con él).
 */

type RGBA = [number, number, number, number];

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

const RECT_FILL: RGBA = [0xfe, 0xf0, 0x8a, 255]; // #fef08a
const ELLIPSE_FILL: RGBA = [0xf9, 0x73, 0x16, 255]; // #f97316
const WHITE: RGBA = [255, 255, 255, 255];

const POINT_ON_RECT = { x: 30, y: 160 }; // dentro del rectángulo, fuera de la ellipse
// (160,160) es el centro geométrico de la ellipse, pero el texto "Impulso"
// (transform y:145, height 40 -> ocupa y:145-185) se dibuja ENCIMA en ese
// mismo punto — se usa (160,90), todavía dentro del radio de la ellipse
// (distancia 70 <= radio 100) pero fuera de la caja del texto.
const POINT_ON_ELLIPSE = { x: 160, y: 90 };
const POINT_ON_BACKGROUND = { x: 5, y: 5 }; // fuera de toda forma (fondo de página)

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
  await page.goto("/");
  await page.waitForSelector("#export-btn");
  // Zoom a 100% exacto: a esa escala, 1 px del canvas == 1 px del
  // documento, así las coordenadas hardcodeadas de arriba aplican tal
  // cual tanto al screenshot del editor como al PNG exportado en 1x.
  await page.click('.zoom-preset:has-text("100%")');
  await page.waitForTimeout(150);
});

test("el PNG exportado (fondo sólido blanco, 1x) coincide pixel a pixel con el canvas del editor", async ({ page }) => {
  const liveScreenshot = await page.locator("#canvas-runtime").screenshot();
  const [liveRect, liveEllipse, liveBackground] = await samplePixelsFromPngBuffer(page, liveScreenshot, [
    POINT_ON_RECT,
    POINT_ON_ELLIPSE,
    POINT_ON_BACKGROUND,
  ]);

  const exportedBuffer = await exportPng(page, { background: "solid", color: "#ffffff", scale: 1, filename: "visual-1x" });
  const [exportedRect, exportedEllipse, exportedBackground] = await samplePixelsFromPngBuffer(page, exportedBuffer, [
    POINT_ON_RECT,
    POINT_ON_ELLIPSE,
    POINT_ON_BACKGROUND,
  ]);

  expectCloseColor(liveRect!, RECT_FILL);
  expectCloseColor(exportedRect!, RECT_FILL);
  expectCloseColor(liveRect!, exportedRect!);

  expectCloseColor(liveEllipse!, ELLIPSE_FILL);
  expectCloseColor(exportedEllipse!, ELLIPSE_FILL);
  expectCloseColor(liveEllipse!, exportedEllipse!);

  expectCloseColor(liveBackground!, WHITE);
  expectCloseColor(exportedBackground!, WHITE);
  expectCloseColor(liveBackground!, exportedBackground!);
});

test("el PNG exportado a 2x reproduce los mismos colores en las coordenadas escaladas", async ({ page }) => {
  const exportedBuffer = await exportPng(page, { background: "solid", color: "#ffffff", scale: 2, filename: "visual-2x" });
  const scale = 2;
  const [rect, ellipse, background] = await samplePixelsFromPngBuffer(page, exportedBuffer, [
    { x: POINT_ON_RECT.x * scale, y: POINT_ON_RECT.y * scale },
    { x: POINT_ON_ELLIPSE.x * scale, y: POINT_ON_ELLIPSE.y * scale },
    { x: POINT_ON_BACKGROUND.x * scale, y: POINT_ON_BACKGROUND.y * scale },
  ]);

  expectCloseColor(rect!, RECT_FILL);
  expectCloseColor(ellipse!, ELLIPSE_FILL);
  expectCloseColor(background!, WHITE);
});

test("el PNG exportado con fondo transparente tiene alpha=0 fuera de toda forma", async ({ page }) => {
  const exportedBuffer = await exportPng(page, { background: "transparent", scale: 1, filename: "visual-transparent" });
  const [background] = await samplePixelsFromPngBuffer(page, exportedBuffer, [POINT_ON_BACKGROUND]);
  expect(background![3]).toBe(0);
});
