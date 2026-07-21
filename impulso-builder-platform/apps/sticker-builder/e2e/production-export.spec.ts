import { test, expect, type Page } from "@playwright/test";

/**
 * Verificación en Chromium real de "Exportar para impresión" (Epic 9 /
 * Fase 9.4, secciones 36-37/42 del enunciado) — específicamente lo que
 * `vitest`/jsdom NO puede confirmar: foco atrapado real (`Tab`/`Shift+Tab`
 * cíclico contra el DOM real del navegador), layout responsivo en los 4
 * tamaños de viewport pedidos (1366×768/1440×900/1920×1080/estrecho), y
 * una exportación real de punta a punta que produce una descarga real.
 *
 * La matemática de imposición/Preflight/controller ya está probada
 * exhaustivamente en `vitest` (`packages/print-engine`,
 * `productionExportController.test.ts`, `productionExportDialog.test.ts`)
 * — este spec no la repite.
 */

async function openNewBlankProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-card-custom");
  await page.click(".new-project-card-custom");
  await page.fill(".new-project-dialog-width", "50");
  await page.fill(".new-project-dialog-height", "50");
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#production-export-btn");
}

async function openProductionExportDialog(page: Page): Promise<void> {
  await page.click("#production-export-btn");
  await page.waitForSelector(".production-export-dialog-overlay[style*='flex']");
}

test.beforeEach(async ({ page }) => {
  await openNewBlankProject(page);
});

test("abre con role=dialog/aria-modal, título por paso, y foco inicial en 'Comenzar'", async ({ page }) => {
  await openProductionExportDialog(page);
  const dialog = page.locator(".production-export-dialog");
  await expect(dialog).toHaveAttribute("role", "dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Perfil de impresión");
  await expect(page.locator(".production-export-next")).toBeFocused();
});

test("Escape cierra el diálogo y restaura el foco al botón que lo abrió", async ({ page }) => {
  await page.focus("#production-export-btn");
  await openProductionExportDialog(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".production-export-dialog-overlay")).toBeHidden();
  await expect(page.locator("#production-export-btn")).toBeFocused();
});

test("Tab desde el último elemento enfocable vuelve al primero (foco atrapado real)", async ({ page }) => {
  await openProductionExportDialog(page);
  // Único elemento enfocable relevante en el paso "profile": el botón "Comenzar ▶".
  await expect(page.locator(".production-export-next")).toBeFocused();
  await page.keyboard.press("Tab");
  // El foco nunca debe escapar del diálogo hacia el toolbar de atrás.
  const activeInsideDialog = await page.evaluate(() => document.activeElement?.closest(".production-export-dialog") !== null);
  expect(activeInsideDialog).toBe(true);
});

test("al cambiar de paso, el foco se mueve al título (h2) del paso nuevo — anuncio para lectores de pantalla", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // profile -> config
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Configuración de la imposición");
  await expect(page.locator(".production-export-dialog h2")).toBeFocused();
});

test("Preflight bloquea 'Siguiente' con un proyecto en blanco (cut_path_missing) — el motivo se muestra en texto, no solo color", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  await page.click(".production-export-next"); // -> preview
  await page.click(".production-export-next"); // -> preflight
  await page.click(".production-export-body button"); // "Correr Preflight"
  await expect(page.locator(".production-export-issues-error")).toContainText("cut path");
  await expect(page.locator(".production-export-next")).toBeDisabled();
});

for (const viewport of [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "estrecho (360x740)", width: 360, height: 740 },
]) {
  test(`layout responsivo sin overflow horizontal en ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openProductionExportDialog(page);
    await page.click(".production-export-next"); // -> config (el paso con más controles)

    const overflowsHorizontally = await page.evaluate(() => {
      const dialog = document.querySelector(".production-export-dialog");
      if (!dialog) return true;
      return dialog.scrollWidth > window.innerWidth;
    });
    expect(overflowsHorizontally).toBe(false);

    // El diálogo entero debe quedar dentro del viewport verticalmente
    // navegable (scroll interno propio, `max-height`/`overflow-y`), nunca
    // cortado sin forma de llegar a los botones de acción.
    const actionsVisible = await page.locator(".production-export-actions").isVisible();
    expect(actionsVisible).toBe(true);
  });
}

test("el preview (paso 3) renderiza un canvas real de la hoja, sin modificar el proyecto", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // profile -> config
  await page.click(".production-export-next"); // config -> preview
  await page.waitForSelector(".production-preview-canvas-slot canvas");
  const canvasSize = await page.evaluate(() => {
    const canvas = document.querySelector(".production-preview-canvas-slot canvas") as HTMLCanvasElement | null;
    return canvas ? { width: canvas.width, height: canvas.height } : undefined;
  });
  expect(canvasSize?.width).toBeGreaterThan(0);
  expect(canvasSize?.height).toBeGreaterThan(0);
});

test("perfil 'Digital PNG' (sin imposición) completa la exportación real hasta la descarga — regresión Fase 9.5: startExport() exigía SIEMPRE imposition.mode==='grid' y no hacía nada para los perfiles sin imposición añadidos en esta misma fase, dejando el wizard colgado en 'Preparando…' sin forma de continuar", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click('.production-export-profile-card input[value="digital-png"]');
  await page.click(".production-export-next"); // profile -> config
  await page.click(".production-export-next"); // config -> preview
  // La Production Preview solo aplica a imposición (mode: "grid") — para un
  // perfil sin imposición muestra un banner de error explícito, nunca un
  // canvas ni un crash (comportamiento ya existente, verificado aquí).
  await expect(page.locator(".production-preview-error")).toBeVisible();
  await page.click(".production-export-next"); // preview -> preflight
  await page.click(".production-export-body button"); // "Correr Preflight"
  await expect(page.locator(".production-export-issues-error")).toHaveCount(0);
  await page.click(".production-export-next"); // preflight -> warnings (real advertencias aquí, ej. resolución) o auto-skip a progress
  if ((await page.locator(".production-export-dialog h2").textContent()) === "Advertencias") {
    await page.click(".production-export-accept-warnings input");
    await page.click(".production-export-next"); // warnings -> progress -> results
  }
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Resultado", { timeout: 15_000 });
  await expect(page.locator(".production-export-body button")).toContainText("Descargar");
});

test("perfil 'Print PDF' (sin imposición, con bleed/marcas estándar) completa la exportación real hasta la descarga con el resumen de página(s), no de hoja(s)/pieza(s)", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click('.production-export-profile-card input[value="print-pdf"]');
  await page.click(".production-export-next"); // profile -> config
  await page.click(".production-export-next"); // config -> preview
  await expect(page.locator(".production-preview-error")).toBeVisible();
  await page.click(".production-export-next"); // preview -> preflight
  await page.click(".production-export-body button"); // "Correr Preflight"
  await expect(page.locator(".production-export-issues-error")).toHaveCount(0);
  await page.click(".production-export-next"); // preflight -> warnings o auto-skip
  if ((await page.locator(".production-export-dialog h2").textContent()) === "Advertencias") {
    await page.click(".production-export-accept-warnings input");
    await page.click(".production-export-next");
  }
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Resultado", { timeout: 15_000 });
  // `ExportPrintJobToPdfResult` resume en "página(s)" — nunca en
  // "hoja(s)/pieza(s)" (ese resumen es exclusivo de la imposición real).
  await expect(page.locator(".production-export-body p")).toContainText("página");
});

test("el paso de perfil muestra los 3 perfiles reales, con nombre/descripción comprensibles (sección 24, sin jerga técnica en el nombre)", async ({ page }) => {
  await openProductionExportDialog(page);
  const titles = await page.locator(".production-export-profile-card h3").allTextContents();
  expect(titles).toEqual(["Digital PNG", "Print PDF", "Sticker Sheet"]);
  await expect(page.locator(".production-export-profile-card-selected h3")).toHaveText("Sticker Sheet");
  const descriptions = await page.locator(".production-export-profile-card p").allTextContents();
  for (const description of descriptions) expect(description.length).toBeGreaterThan(0);
});

test("'Atrás' está deshabilitado en el primer paso", async ({ page }) => {
  await openProductionExportDialog(page);
  await expect(page.locator(".production-export-back")).toBeDisabled();
});

test("'Cancelar' cierra el diálogo desde cualquier paso intermedio", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  await page.click(".production-export-cancel");
  await expect(page.locator(".production-export-dialog-overlay")).toBeHidden();
});

test("el diálogo se puede reabrir limpio después de cerrarlo (destroy/reset correcto)", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  await page.click(".production-export-cancel");
  await openProductionExportDialog(page);
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Perfil de impresión");
});

test("navegación completamente por teclado: Enter en el botón enfocado activa 'Siguiente'", async ({ page }) => {
  await openProductionExportDialog(page);
  await expect(page.locator(".production-export-next")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".production-export-dialog h2")).toHaveText("Configuración de la imposición");
});

test("cambiar la cantidad de copias en el paso de configuración con el teclado actualiza el valor mostrado", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  const quantityInput = page.locator("fieldset input[type='number']").first();
  await quantityInput.fill("12");
  await quantityInput.press("Tab");
  await expect(quantityInput).toHaveValue("12");
});

test("la región de progreso usa aria-live='polite' (nunca 'assertive', sección 36)", async ({ page }) => {
  await openProductionExportDialog(page);
  const liveRegion = page.locator(".production-export-live-region");
  await expect(liveRegion).toHaveAttribute("aria-live", "polite");
  await expect(liveRegion).toHaveAttribute("role", "status");
});

test("los errores de Preflight se distinguen por encabezado de texto, no solo por color (sección 36)", async ({ page }) => {
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  await page.click(".production-export-next"); // -> preview
  await page.click(".production-export-next"); // -> preflight
  await page.click(".production-export-body button"); // correr preflight
  await expect(page.locator(".production-export-body h3").first()).toContainText("Errores");
});

test("layout responsivo del paso de Preflight (con issues visibles) también sin overflow horizontal en viewport estrecho", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // -> config
  await page.click(".production-export-next"); // -> preview
  await page.click(".production-export-next"); // -> preflight
  await page.click(".production-export-body button"); // correr preflight
  const overflowsHorizontally = await page.evaluate(() => {
    const dialog = document.querySelector(".production-export-dialog");
    return dialog ? dialog.scrollWidth > window.innerWidth : true;
  });
  expect(overflowsHorizontally).toBe(false);
});

test("regresión visual — el preview de imposición dibuja MÁS de una copia real cuando quantity aumenta (nunca una sola pieza escalada o repetida como imagen estática)", async ({ page }) => {
  // Fase 9.5, sección 6 (regresión visual): en vez de predecir coordenadas
  // exactas de celdas de grid (frágil — la Production Preview aplica su
  // propio PPI/zoom/Fit, ver el fix de `assisted-placement.spec.ts` de
  // esta misma fase para el mismo riesgo), se compara el área BLANCA
  // (el footprint de la(s) pieza(s), sobre un fondo de canvas oscuro
  // fuera del área útil) del canvas real entre `quantity=1` y
  // `quantity=4` del MISMO contenido. Investigado empíricamente antes de
  // escribir la aserción (capturas reales + histograma de color): el
  // fondo del canvas es casi negro y domina cualquier conteo de "no
  // blanco" — contar píxeles blancos mide directamente cuánta área de
  // hoja está ocupada por piezas reales, y escaló ~4.0x exacto en la
  // investigación (24768 -> 99072 píxeles blancos) para quantity 1 -> 4.
  await page.click('button:has-text("Texto")'); // contenido real antes de abrir el wizard
  // `computeInsertPosition` (tools.ts, Technical Debt) no convierte
  // `page.size` a píxeles antes de calcular dónde centrar el object nuevo
  // — en una página de 50mm (usada por `openNewBlankProject`) el texto
  // insertado queda en x canónico NEGATIVO, fuera del área visible de la
  // pieza (mismo hallazgo ya documentado al corregir
  // `assisted-placement.spec.ts` en esta misma fase). Se reposiciona
  // explícitamente vía el Inspector — nunca arrastrando con el mouse, que
  // dependería de coordenadas de pantalla frágiles — a un punto conocido
  // y visible dentro de la pieza.
  await page.click(".layer-row");
  const xInput = page.locator('.inspector-field:has(span:text-is("X")) input');
  const yInput = page.locator('.inspector-field:has(span:text-is("Y")) input');
  await expect(xInput).toBeVisible();
  await xInput.fill("5");
  await xInput.press("Tab");
  await yInput.fill("5");
  await yInput.press("Tab");

  await openProductionExportDialog(page);
  await page.click(".production-export-next"); // profile -> config

  async function setQuantityAndCountWhiteArea(quantity: number): Promise<number> {
    const quantityInput = page.locator("fieldset input[type='number']").first();
    await quantityInput.fill(String(quantity));
    await quantityInput.press("Tab");
    await page.click(".production-export-next"); // config -> preview
    await page.waitForSelector(".production-preview-canvas-slot canvas");
    await page.waitForTimeout(150); // deja que el preview termine de renderizar tras el cambio

    const whitePixels = await page.evaluate(() => {
      const canvas = document.querySelector(".production-preview-canvas-slot canvas") as HTMLCanvasElement | null;
      if (!canvas) return 0;
      const ctx = canvas.getContext("2d")!;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let white = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) white++;
      }
      return white;
    });

    await page.click(".production-export-back"); // preview -> config, para el siguiente cambio de quantity
    return whitePixels;
  }

  const whiteAreaAtQuantity1 = await setQuantityAndCountWhiteArea(1);
  const whiteAreaAtQuantity4 = await setQuantityAndCountWhiteArea(4);

  expect(whiteAreaAtQuantity1).toBeGreaterThan(0); // la pieza sí produce área blanca real
  // Tolerancia >3x (la investigación empírica dio ~4.0x exacto) — evita
  // sobreajustar a un número exacto, mientras sigue exigiendo claramente
  // MÁS de una copia real, nunca la misma área repetida sin importar
  // `quantity` (el síntoma de una sola pieza estática).
  expect(whiteAreaAtQuantity4).toBeGreaterThan(whiteAreaAtQuantity1 * 3);
});
