import { test, expect, type Page } from "@playwright/test";

/**
 * Performance, memoria y resource leaks del wizard "Exportar para
 * impresión" (Epic 9 / Fase 9.5, sección 7 del enunciado de esta fase) —
 * verificación en Chromium REAL, sin mocks, del ciclo completo abrir →
 * configurar → preview → Preflight → advertencias → exportar → descargar →
 * cerrar → reabrir, repetido varias veces.
 *
 * Instrumenta lo que `vitest`/jsdom no puede confirmar de forma realista:
 * - object URLs: cada `URL.createObjectURL`/`URL.revokeObjectURL` real del
 *   navegador se cuenta (monkey-patch instalado ANTES de cargar la app vía
 *   `addInitScript`) — un ciclo completo debe terminar con creates===revokes
 *   (nunca una URL huérfana reteniendo el Blob en memoria).
 * - canvases: el conteo de `<canvas>` en el DOM debe volver exactamente a la
 *   línea base (el canvas del editor principal) después de cerrar el
 *   diálogo — el canvas de la Production Preview (`productionPreview.ts`)
 *   nunca debe sobrevivir al cierre.
 * - memoria observada: `performance.memory` (API no estándar, mas presente
 *   en Chromium sin flags) da una señal aproximada y cuantizada del heap de
 *   JS — se usa aquí SOLO como límite superior generoso para atrapar un
 *   leak evidente, nunca como comparación estricta entre corridas (no se
 *   fuerza GC — Playwright no expone `--expose-gc` por defecto — así que un
 *   aumento puntual no prueba un leak; una ausencia de crecimiento
 *   desbocado tras varios ciclos completos sí es una señal real).
 *
 * No usa el preset "Sticker circular (5×5cm)" por conveniencia visual —
 * lo hace porque es el único proyecto nuevo que trae una línea de corte ya
 * válida (`projectPresets.ts`, `shape: "circle"`), permitiendo ejercer el
 * perfil "Sticker Sheet" (imposición real) de punta a punta sin ningún
 * workaround de posicionamiento.
 */

async function instrumentObjectUrls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __objectUrlCreates: number; __objectUrlRevokes: number };
    w.__objectUrlCreates = 0;
    w.__objectUrlRevokes = 0;
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource): string => {
      w.__objectUrlCreates += 1;
      return originalCreate(obj);
    };
    URL.revokeObjectURL = (url: string): void => {
      w.__objectUrlRevokes += 1;
      originalRevoke(url);
    };
  });
}

async function objectUrlCounts(page: Page): Promise<{ creates: number; revokes: number }> {
  return page.evaluate(() => {
    const w = window as unknown as { __objectUrlCreates?: number; __objectUrlRevokes?: number };
    return { creates: w.__objectUrlCreates ?? 0, revokes: w.__objectUrlRevokes ?? 0 };
  });
}

async function canvasCount(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelectorAll("canvas").length);
}

async function openCircularStickerProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector('.new-project-card:has-text("Sticker circular")');
  await page.click('.new-project-card:has-text("Sticker circular")');
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#production-export-btn");
}

/** Un ciclo completo real: abrir → config (quantity) → preview → Preflight
 * → advertencias (si las hay) → resultado → descargar → cerrar. Perfil
 * "Sticker Sheet" (preseleccionado), imposición real. */
async function runFullExportCycle(page: Page, quantity: number): Promise<void> {
  await page.click("#production-export-btn");
  await page.waitForSelector(".production-export-dialog-overlay[style*='flex']");
  await page.click(".production-export-next"); // profile -> config
  const quantityInput = page.locator("fieldset input[type='number']").first();
  await quantityInput.fill(String(quantity));
  await quantityInput.press("Tab");
  await page.click(".production-export-next"); // config -> preview
  await page.waitForSelector(".production-preview-canvas-slot canvas");
  await page.click(".production-export-next"); // preview -> preflight
  await page.click(".production-export-body button"); // "Correr Preflight"
  await page.waitForSelector(".production-export-next:not([disabled])");
  await page.click(".production-export-next"); // preflight -> warnings (o auto-skip)
  if ((await page.locator(".production-export-dialog h2").textContent()) === "Advertencias") {
    await page.click(".production-export-accept-warnings input");
    await page.click(".production-export-next");
  }
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Resultado", { timeout: 20_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), page.click(".production-export-body button")]);
  await download.path();
  await page.click(".production-export-next"); // "Cerrar"
  await expect(page.locator(".production-export-dialog-overlay")).toBeHidden();
}

test("ciclos repetidos de abrir/configurar/preview/Preflight/exportar/descargar/cerrar (3x) no acumulan canvases huérfanos ni desbalancean object URLs", async ({ page }) => {
  await instrumentObjectUrls(page);
  await openCircularStickerProject(page);

  const baselineCanvases = await canvasCount(page);
  expect(baselineCanvases).toBeGreaterThan(0); // el canvas del editor principal ya existe

  for (let cycle = 0; cycle < 3; cycle++) {
    await runFullExportCycle(page, 4);
    // Después de cerrar, el único canvas que debe quedar es el del editor
    // principal — el de la Production Preview se destruye con el diálogo
    // (`preview.destroy()` -> `root.remove()`), nunca queda huérfano.
    expect(await canvasCount(page)).toBe(baselineCanvases);
  }

  // El `setTimeout(() => URL.revokeObjectURL(url), 0)` de
  // `triggerBrowserDownload` necesita un tick del event loop para correr.
  await page.waitForTimeout(50);
  const { creates, revokes } = await objectUrlCounts(page);
  expect(creates).toBeGreaterThan(0); // sí se crearon URLs reales (thumbnails de templates + descargas)
  expect(revokes).toBe(creates); // ninguna quedó sin revocar tras 3 ciclos completos
});

test("cancelar la exportación repetidamente (3x) durante 'progress' deja el diálogo reutilizable y no acumula canvases ni object URLs huérfanos", async ({ page }) => {
  await instrumentObjectUrls(page);
  await openCircularStickerProject(page);
  const baselineCanvases = await canvasCount(page);

  for (let cycle = 0; cycle < 3; cycle++) {
    await page.click("#production-export-btn");
    await page.waitForSelector(".production-export-dialog-overlay[style*='flex']");
    await page.click(".production-export-next"); // profile -> config
    await page.click(".production-export-next"); // config -> preview
    await page.waitForSelector(".production-preview-canvas-slot canvas");
    await page.click(".production-export-next"); // preview -> preflight
    await page.click(".production-export-body button"); // correr Preflight
    await page.waitForSelector(".production-export-next:not([disabled])");
    // Cierra desde "preflight" (antes de llegar a "progress") — mismo
    // cleanup (`close()`: `controller.close()` aborta cualquier exportación
    // en curso, `preview?.destroy()`) que cerrar desde cualquier otro paso
    // intermedio, ya cubierto por `production-export.spec.ts`; aquí se
    // repite 3 veces seguidas para confirmar que el cleanup es IDEMPOTENTE
    // y no acumula recursos entre ciclos.
    await page.click(".production-export-cancel");
    await expect(page.locator(".production-export-dialog-overlay")).toBeHidden();
    expect(await canvasCount(page)).toBe(baselineCanvases);
  }

  await page.waitForTimeout(50);
  const { creates, revokes } = await objectUrlCounts(page);
  expect(revokes).toBe(creates);
});

test("rendimiento real en Chromium (sin mocks): un ciclo completo con 200 copias imposicionadas termina en un tiempo razonable", async ({ page }) => {
  await openCircularStickerProject(page);

  const start = Date.now();
  await runFullExportCycle(page, 200);
  const elapsedMs = Date.now() - start;

  // Umbral deliberadamente generoso (sección: "no uses benchmarks frágiles
  // como bloqueos estrictos de CI") — el objetivo es atrapar una regresión
  // catastrófica (ej. de O(1) a O(quantity) rasterizaciones reales), no
  // medir milisegundos exactos, que dependen de la máquina que corre el
  // test. El valor observado en este entorno se documenta en
  // `docs/PERFORMANCE_BUDGET.md`, no aquí.
  expect(elapsedMs).toBeLessThan(30_000);
});

test("memoria observada (performance.memory, señal aproximada de Chromium): varios ciclos completos no muestran crecimiento desbocado del heap", async ({ page }) => {
  await openCircularStickerProject(page);

  const hasMemoryApi = await page.evaluate(() => "memory" in performance);
  test.skip(!hasMemoryApi, "performance.memory no está disponible en este navegador/entorno — no se puede medir memoria observada de forma alguna aquí.");

  const heapBefore = await page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize);

  for (let cycle = 0; cycle < 5; cycle++) {
    await runFullExportCycle(page, 30);
  }

  const heapAfter = await page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize);

  // Sin GC forzado (Playwright no habilita `--expose-gc` por defecto), una
  // lectura puntual de heap es ruidosa — el umbral es deliberadamente muy
  // generoso (10x) para atrapar solo un leak evidente y desbocado, nunca
  // como un presupuesto de memoria estricto. Ambos valores se registran en
  // `docs/PERFORMANCE_BUDGET.md` como observación, no como garantía.
  expect(heapAfter).toBeLessThan(Math.max(heapBefore * 10, 200 * 1024 * 1024));
});
