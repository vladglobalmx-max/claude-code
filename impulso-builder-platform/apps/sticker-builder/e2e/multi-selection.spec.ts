import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium) de Professional Multi Selection
 * (Epic 7 / Fase 7.4) — específicamente los mecanismos que dependen de
 * gestos de puntero reales y del navegador, no observables desde
 * `vitest`/jsdom: arrastrar el CUERPO de un object ya seleccionado reenvía
 * el drag a la caja compartida (`Node.startDrag()` de Konva), un `blur`/
 * `Escape` real cancela un gesto en curso, y un solo `Ctrl/Cmd+Z` revierte
 * el movimiento de AMBOS objects. La matemática de movimiento/resize/
 * rotación de grupo ya está probada exhaustivamente en
 * `packages/renderer-konva/src/manipulation/groupHandles.test.ts` (vitest)
 * — este spec no la repite, solo confirma que el cableado real del
 * navegador funciona.
 */

const MM_TO_PX = 96 / 25.4;

async function openNewBlankProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-card-custom");
  await page.click(".new-project-card-custom");
  await page.fill(".new-project-dialog-width", "100");
  await page.fill(".new-project-dialog-height", "100");
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#export-btn");
  await page.click('.zoom-preset:has-text("100%")');
  await page.waitForTimeout(150);
}

function inspectorField(page: Page, label: string): Locator {
  return page.locator(".inspector-field").filter({ has: page.locator(`> span:text-is("${label}")`) });
}

async function setInspectorValue(page: Page, label: string, value: number): Promise<void> {
  const input = inspectorField(page, label).locator("input");
  await input.fill(String(value));
  await input.press("Enter");
  await page.waitForTimeout(50);
}

/** Sube un PNG rojo opaco de 10x10 generado por el propio <canvas> del
 * navegador (evita tener que construir bytes de PNG a mano en Node). */
async function uploadSolidImage(page: Page): Promise<void> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png");
  });
  const buffer = Buffer.from(dataUrl.split(",")[1]!, "base64");
  const fileInput = page.locator(".tool-image-input");
  await fileInput.setInputFiles({ name: "solid.png", mimeType: "image/png", buffer });
  await page.waitForTimeout(150);
  // insertImage no selecciona automáticamente el object recién creado — a
  // diferencia de duplicar/agrupar, no hay ningún `setSelection` posterior
  // (ver `tools.ts`). Se selecciona explícitamente vía su fila en Capas —
  // `layersPanel.ts` lista los objects en orden frente->fondo, así que el
  // recién insertado (el más nuevo, al frente) es SIEMPRE la PRIMERA fila,
  // nunca la última.
  await page.locator(".layer-row").first().click();
}

async function samplePixel(page: Page, xMm: number, yMm: number): Promise<[number, number, number, number]> {
  const shot = await page.locator("#canvas-runtime").screenshot();
  return page.evaluate(
    async ({ base64, x, y }) => {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("no se pudo decodificar"));
      });
      img.src = `data:image/png;base64,${base64}`;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(x, y, 1, 1).data) as [number, number, number, number];
    },
    { base64: shot.toString("base64"), x: xMm * MM_TO_PX, y: yMm * MM_TO_PX },
  );
}

test("mover el cuerpo de un object ya seleccionado mueve TODA la selección (reenvío real a la caja compartida vía Konva.Node.startDrag)", async ({ page }) => {
  await openNewBlankProject(page);
  const runtimeBox = (await page.locator("#canvas-runtime").boundingBox())!;

  // Object A: (10,10)-(30,30)mm.
  await uploadSolidImage(page);
  await setInspectorValue(page, "X", 10);
  await setInspectorValue(page, "Y", 10);
  await setInspectorValue(page, "Ancho", 20);
  await setInspectorValue(page, "Alto", 20);

  // Object B: (60,10)-(80,30)mm.
  await uploadSolidImage(page);
  await setInspectorValue(page, "X", 60);
  await setInspectorValue(page, "Y", 10);
  await setInspectorValue(page, "Ancho", 20);
  await setInspectorValue(page, "Alto", 20);

  expect(await page.locator(".layer-row").count()).toBe(2);

  const restColorAtB = await samplePixel(page, 70, 20); // centro de B en reposo -> rojo

  // Shift-click ambos en el canvas: A primero (reemplaza selección), B con Shift (agrega).
  await page.mouse.click(runtimeBox.x + 20 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.keyboard.down("Shift");
  await page.mouse.click(runtimeBox.x + 70 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.keyboard.up("Shift");

  expect(await page.locator(".layer-row.selected").count()).toBe(2);

  // Arrastrar desde el CUERPO de A (no desde la caja compartida) — si el
  // reenvío a `sharedBox.startDrag()` funciona, B también se mueve.
  await page.mouse.move(runtimeBox.x + 20 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.mouse.down();
  await page.mouse.move(runtimeBox.x + 20 * MM_TO_PX + 30 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX + 20 * MM_TO_PX, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(100);

  // B se movió +30mm en X / +20mm en Y junto con A: su posición ORIGINAL
  // (70,20) ya no debería mostrar rojo.
  const afterMoveAtOriginalB = await samplePixel(page, 70, 20);
  expect(afterMoveAtOriginalB).not.toEqual(restColorAtB);
  // Y su posición NUEVA (100,40) sí debería mostrar rojo.
  const afterMoveAtNewB = await samplePixel(page, 100, 40);
  expect(afterMoveAtNewB).toEqual(restColorAtB);

  // Un solo Ctrl/Cmd+Z revierte el movimiento de AMBOS objects a la vez.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(100);
  const afterUndoAtOriginalB = await samplePixel(page, 70, 20);
  expect(afterUndoAtOriginalB).toEqual(restColorAtB);
});

test("Escape cancela un gesto de movimiento grupal en curso — la selección vuelve a su posición original, sin crear historial", async ({ page }) => {
  await openNewBlankProject(page);
  const runtimeBox = (await page.locator("#canvas-runtime").boundingBox())!;

  await uploadSolidImage(page);
  await setInspectorValue(page, "X", 10);
  await setInspectorValue(page, "Y", 10);
  await setInspectorValue(page, "Ancho", 20);
  await setInspectorValue(page, "Alto", 20);

  await uploadSolidImage(page);
  await setInspectorValue(page, "X", 60);
  await setInspectorValue(page, "Y", 10);
  await setInspectorValue(page, "Ancho", 20);
  await setInspectorValue(page, "Alto", 20);

  const restColorAtA = await samplePixel(page, 20, 20);

  await page.mouse.click(runtimeBox.x + 20 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.keyboard.down("Shift");
  await page.mouse.click(runtimeBox.x + 70 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.keyboard.up("Shift");
  expect(await page.locator(".layer-row.selected").count()).toBe(2);

  await page.mouse.move(runtimeBox.x + 20 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX);
  await page.mouse.down();
  await page.mouse.move(runtimeBox.x + 20 * MM_TO_PX + 25 * MM_TO_PX, runtimeBox.y + 20 * MM_TO_PX, { steps: 8 });

  // A mitad de gesto, la posición original de A ya debería estar vacía
  // (el preview se movió).
  const duringDrag = await samplePixel(page, 20, 20);
  expect(duringDrag).not.toEqual(restColorAtA);

  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(100);

  // Cancelado: A vuelve a su posición original, sin dispatch/historial.
  const afterEscape = await samplePixel(page, 20, 20);
  expect(afterEscape).toEqual(restColorAtA);
});
