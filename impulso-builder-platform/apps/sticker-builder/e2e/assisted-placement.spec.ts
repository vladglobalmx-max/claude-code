import { test, expect } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium) de Assisted Placement (Epic 7 /
 * Fase 7.3): Grid visual, Snap to Grid, Rulers, indicador de puntero, y
 * Smart Guides durante un drag real — nada de esto es observable desde
 * `vitest`/jsdom (no hay layout real, ni un canvas 2D funcional, ni un
 * `pointermove` con coordenadas de pantalla significativas).
 *
 * La app es Workspace-first (ver ADR-0014): cada test navega
 * Workspace -> "Nuevo proyecto" -> crear, antes de llegar al editor.
 */

async function openNewBlankProject(page: import("@playwright/test").Page): Promise<void> {
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

test("el botón de Grid muestra/oculta el overlay y el de Snap alterna su estado activo; el atajo G también alterna Grid", async ({ page }) => {
  await openNewBlankProject(page);

  const gridOverlay = page.locator("#canvas-runtime .grid-overlay");
  await expect(gridOverlay).toBeHidden();

  const [gridButton, snapButton] = await page.locator("#grid-snap-container button").all();
  await gridButton!.click();
  await expect(gridOverlay).toBeVisible();
  await expect(gridButton!).toHaveClass(/active/);

  await expect(snapButton!).not.toHaveClass(/active/);
  await snapButton!.click();
  await expect(snapButton!).toHaveClass(/active/);

  await page.keyboard.press("g");
  await expect(gridOverlay).toBeHidden();
});

test("las Rulers se renderizan con dimensiones reales y el atajo R las oculta", async ({ page }) => {
  await openNewBlankProject(page);

  const horizontal = page.locator("#ruler-horizontal");
  const vertical = page.locator("#ruler-vertical");
  await expect(horizontal).toBeVisible();
  await expect(vertical).toBeVisible();

  const box = await horizontal.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);

  await page.keyboard.press("r");
  await expect(horizontal).toBeHidden();
  await expect(vertical).toBeHidden();
});

test("el indicador de puntero muestra X/Y en page.unit dentro de la página y se oculta fuera de ella", async ({ page }) => {
  await openNewBlankProject(page);

  const runtimeBox = (await page.locator("#canvas-runtime").boundingBox())!;
  const indicator = page.locator("#pointer-indicator");

  await page.mouse.move(runtimeBox.x + 50, runtimeBox.y + 60);
  await expect(indicator).toHaveText(/X: \d+(\.\d+)?mm\s+Y: \d+(\.\d+)?mm/);

  await page.mouse.move(runtimeBox.x - 50, runtimeBox.y - 50);
  await expect(indicator).toBeHidden();
});

test("Smart Guides: arrastrar la línea de corte cerca del centro de la página dibuja una guía visible y la retira al soltar", async ({ page }) => {
  // A diferencia de los otros 3 tests, este usa el preset "Sticker circular
  // (5x5 cm)" preseleccionado por defecto en el diálogo — trae consigo un
  // EllipseObject real ("Línea de corte") que se puede arrastrar. Se evita
  // depender de la posición donde el toolbar inserta objects nuevos
  // (Texto/Imagen), que no es determinística en píxeles de forma sencilla
  // desde este spec.
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-dialog-create");
  await page.click(".new-project-dialog-create"); // deja el preset preseleccionado, no toca "Personalizado"
  await page.waitForSelector("#export-btn");
  await page.click('.zoom-preset:has-text("100%")');
  await page.waitForTimeout(150);

  const runtimeBox = (await page.locator("#canvas-runtime").boundingBox())!;

  async function samplePixel(x: number, y: number): Promise<[number, number, number, number]> {
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
      { base64: shot.toString("base64"), x, y },
    );
  }

  // La línea de corte queda en (0,0)-(50,50) del espacio de pantalla del
  // canvas (bug pre-existente y fuera de alcance de esta fase: su `size`
  // se guarda en mm crudos, sin convertir a px — ver Technical Debt). Se
  // aprovecha esa posición conocida en vez de intentar corregirla aquí.
  const pageCenterX = runtimeBox.width / 2; // candidato de snap: centro horizontal de página

  // (pageCenterX, 150): fuera del AABB de la línea de corte en cualquiera
  // de las dos posiciones (antes y después del drag), y fuera de la
  // ellipse misma — fondo blanco puro en reposo.
  const restColor = await samplePixel(pageCenterX, 150);

  await page.mouse.move(runtimeBox.x + 25, runtimeBox.y + 25); // centro de la línea de corte (0,0)-(50,50)
  await page.mouse.down();
  // Mover el centro a ~pageCenterX: el borde derecho (maxX) queda a ~2px
  // del centro de página — dentro de tolerancia de snap (8px a 100% zoom).
  await page.mouse.move(runtimeBox.x + pageCenterX - 23, runtimeBox.y + 25, { steps: 5 });

  const duringDragColor = await samplePixel(pageCenterX, 150);
  expect(duringDragColor).not.toEqual(restColor);

  await page.mouse.up();
  await page.waitForTimeout(100);
  const afterDropColor = await samplePixel(pageCenterX, 150);
  expect(afterDropColor).toEqual(restColor);
});
