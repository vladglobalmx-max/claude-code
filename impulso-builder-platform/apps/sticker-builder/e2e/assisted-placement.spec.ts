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

/** Página de 300mm — deliberadamente grande, solo para el test de Smart
 * Guides de abajo (ver su describe block, que amplía el viewport para que
 * quepa sin scroll). El motivo: `computeInsertPosition` (tools.ts) tiene un
 * bug real y ya documentado (Technical Debt) — usa `page.size.width/height`
 * CRUDOS (el número en mm, sin convertir a px) para centrar el object
 * nuevo. Con una página de 100mm eso ubica el texto en x canónico NEGATIVO
 * (fuera del canvas, confirmado empíricamente con una captura real durante
 * la investigación de esta fase — el `TextObject` insertado quedaba
 * parcialmente fuera del área visible). Con 300mm, `300/2 - 80 = 70`
 * (positivo, con margen) — la página grande es un workaround deliberado a
 * ESE bug, no una corrección del bug en sí (fuera de alcance de este
 * fix puntual; el bug en sí sigue registrado en Technical Debt). */
async function openLargeBlankProject(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-card-custom");
  await page.click(".new-project-card-custom");
  await page.fill(".new-project-dialog-width", "300");
  await page.fill(".new-project-dialog-height", "300");
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

test.describe("Smart Guides durante un drag real", () => {
  // Viewport ampliado SOLO para este test — la página de 300mm (ver
  // `openLargeBlankProject`) renderiza un canvas de ~1134px de alto, que no
  // entra en el viewport por defecto de Playwright (720px de alto) sin
  // scroll; con scroll, `locator.screenshot()` deja de reflejar
  // confiablemente el pixel exacto que interesa. Confirmado empíricamente
  // durante la investigación: con el viewport por defecto, la fila
  // muestreada aparecía completamente "no-blanca" incluso en reposo (el
  // canvas real quedaba cortado); con este viewport, en reposo vuelve a
  // ser casi enteramente blanco salvo las marcas finas de las Rulers.
  test.use({ viewport: { width: 1600, height: 1300 } });

  test("arrastrar un object insertado cerca del centro de la página dibuja una guía visible y la retira al soltar", async ({ page }) => {
    // Rediseñado en Fase 9.5 — causa raíz real encontrada (no era un
    // flake): la versión anterior usaba el preset "Sticker circular",
    // asumiendo que su EllipseObject ("Línea de corte") medía 50x50px de
    // pantalla. Esa asunción dependía de un bug ("size guardado en mm
    // crudos, sin convertir a px") que YA fue corregido en Fase 9.1
    // (`projectPresets.ts` usa `toPixels(widthMm, "mm")` desde entonces)
    // — el test nunca se actualizó cuando el producto se corrigió. Con la
    // corrección, la línea de corte SIEMPRE ocupa el tamaño físico
    // completo de la página (por diseño: el die-line de un sticker
    // circular es el contorno exterior del producto) — un click en
    // (25,25) cae en la esquina de su bounding box, fuera del óvalo real,
    // y el drag nunca llegaba a iniciar (confirmado reproduciendo 5/5
    // veces con un scanline completo de píxeles: cero diferencia entre
    // "antes" y "durante" en toda la fila muestreada).
    //
    // Esta versión usa un `TextObject` insertado por el toolbar: se lee
    // su posición REAL desde el Inspector (nunca se asume/hardcodea), así
    // que sigue siendo válida sin importar si el bug ya documentado de
    // `computeInsertPosition` (no convierte `page.size` a píxeles antes
    // de calcular la posición, ver Technical Debt) se corrige más
    // adelante — y precisamente PORQUE ese bug sigue sin corregirse, se
    // usa una página de 300mm (`openLargeBlankProject`): con una página
    // de 100mm el texto se insertaba en x canónico NEGATIVO (fuera del
    // canvas, confirmado empíricamente), inutilizable para un drag real.
    await openLargeBlankProject(page);

    await page.click('button:has-text("Texto")');
    await page.click(".layer-row"); // selecciona el text recién insertado (addObject no selecciona automáticamente)

    const xInput = page.locator('.inspector-field:has(span:text-is("X")) input');
    const yInput = page.locator('.inspector-field:has(span:text-is("Y")) input');
    await expect(xInput).toBeVisible();
    const MM_TO_PX = 96 / 25.4;
    const objectXPx = Number.parseFloat(await xInput.inputValue()) * MM_TO_PX;
    const objectYPx = Number.parseFloat(await yInput.inputValue()) * MM_TO_PX;

    const runtimeBox = (await page.locator("#canvas-runtime").boundingBox())!;
    const pageCenterX = runtimeBox.width / 2; // candidato de snap: centro horizontal de página

    async function scanRow(y: number): Promise<string> {
      const shot = await page.locator("#canvas-runtime").screenshot();
      return page.evaluate(
        async ({ base64, y }) => {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("no se pudo decodificar"));
            img.src = `data:image/png;base64,${base64}`;
          });
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return Array.from(ctx.getImageData(0, y, img.naturalWidth, 1).data).join(",");
        },
        { base64: shot.toString("base64"), y },
      );
    }

    // Fila muy por debajo del texto insertado (que queda cerca de la
    // esquina superior-izquierda) — nunca cruzada por el object en sí
    // durante todo el gesto (solo se arrastra horizontalmente), pero SÍ
    // cruzada por la guía vertical de "centro de página" cuando aparece
    // (su extensión vertical cubre toda la altura de la página, sección 3).
    const sampleRow = Math.round(runtimeBox.height * 0.8);
    const restRow = await scanRow(sampleRow);

    const clickOffsetX = 10; // desplazamiento fijo del click respecto al borde izquierdo del object
    await page.mouse.move(runtimeBox.x + objectXPx + clickOffsetX, runtimeBox.y + objectYPx + 10);
    await page.mouse.down();
    // Mueve el borde izquierdo del object hasta el centro de la página —
    // dentro de tolerancia de snap (8px de pantalla a 100% zoom) contra el
    // candidato de página (sección 9, Fase 7.3).
    await page.mouse.move(runtimeBox.x + pageCenterX + clickOffsetX, runtimeBox.y + objectYPx + 10, { steps: 8 });

    const duringDragRow = await scanRow(sampleRow);
    expect(duringDragRow).not.toEqual(restRow);

    await page.mouse.up();
    await page.waitForTimeout(100);
    const afterDropRow = await scanRow(sampleRow);
    expect(afterDropRow).toEqual(restRow);
  });
});
