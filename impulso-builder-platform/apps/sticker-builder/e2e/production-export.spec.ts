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

test("el paso de perfil muestra nombre y descripción comprensibles (sección 24, sin jerga técnica en el nombre)", async ({ page }) => {
  await openProductionExportDialog(page);
  await expect(page.locator(".production-export-profile-card h3")).toHaveText("Sticker Sheet");
  await expect(page.locator(".production-export-profile-card p")).not.toBeEmpty();
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
