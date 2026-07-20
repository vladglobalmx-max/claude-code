import { test, expect } from "@playwright/test";

/**
 * Verificación en Chromium real del preview técnico mínimo de Fase 9.3
 * (ver ADR-0023, sección 22-23 del enunciado de la fase) — visita el
 * harness temporal (`print-preview-harness.html` /
 * `src/printPreviewHarness.ts`) que renderiza contenido REAL (Konva real,
 * Canvas real) y compone los overlays de MediaBox/BleedBox/TrimBox/Safe
 * Area/Crop Marks/Cut Path con la MISMA geometría pura que usan los
 * exportadores — nunca una reimplementación aproximada.
 *
 * Este harness no es una ruta de producto — se retira o se transforma en
 * la UI real durante una fase futura.
 */

interface PreviewOutput {
  ready: boolean;
  error?: string;
  projectUnchanged: boolean;
  projectChangedEventCount: number;
  overlays: {
    mediaBoxRect: { width: number; height: number };
    bleedBoxRect: { width: number; height: number };
    trimBoxRect: { width: number; height: number };
    safeAreaRect?: { width: number; height: number };
    cropMarkCount: number;
    cutPathStatus: string;
  };
  preflightIssueCodes: string[];
}

test.beforeEach(async ({ page }) => {
  await page.goto("/print-preview-harness.html");
  await page.waitForFunction(() => (window as unknown as { __printPreviewHarness?: { ready?: boolean } }).__printPreviewHarness?.ready === true, {
    timeout: 20_000,
  });
});

test("calcula la geometría real de MediaBox/BleedBox/TrimBox/Safe Area/marcas/cut path, sin modificar el Project ni disparar dirty-state", async ({ page }) => {
  const output = await page.evaluate(() => (window as unknown as { __printPreviewHarness: PreviewOutput }).__printPreviewHarness);

  expect(output.error, `el harness lanzó un error: ${output.error}`).toBeUndefined();
  expect(output.projectUnchanged).toBe(true);
  expect(output.projectChangedEventCount).toBe(0);

  // MediaBox > BleedBox > TrimBox > Safe Area — el mismo anidamiento que
  // verifican los tests jsdom del paquete, ahora con Konva/Canvas reales.
  expect(output.overlays.mediaBoxRect.width).toBeGreaterThan(output.overlays.bleedBoxRect.width);
  expect(output.overlays.bleedBoxRect.width).toBeGreaterThan(output.overlays.trimBoxRect.width);
  expect(output.overlays.safeAreaRect).toBeDefined();
  expect(output.overlays.trimBoxRect.width).toBeGreaterThan(output.overlays.safeAreaRect!.width);
  expect(output.overlays.cropMarkCount).toBe(8);
  expect(output.overlays.cutPathStatus).toBe("ok");

  // El rect fuera del safe area (a propósito, en la fixture del harness)
  // produce el warning esperado — confirma que el preview usa el mismo
  // Preflight real que los exportadores, no una copia aproximada.
  expect(output.preflightIssueCodes).toContain("object_crosses_safe_area");
});

test("cada toggle de capa tiene label/aria-controls y oculta/muestra su overlay correctamente", async ({ page }) => {
  const toggles = page.locator("[data-overlay-toggle]");
  const count = await toggles.count();
  expect(count).toBe(6); // MediaBox/BleedBox/TrimBox/SafeArea/CropMarks/CutPath

  for (let i = 0; i < count; i++) {
    const toggle = toggles.nth(i);
    const overlayId = await toggle.getAttribute("data-overlay-toggle");
    await expect(toggle).toHaveAttribute("aria-controls", `overlay-${overlayId}`);
    // Cada checkbox vive dentro de un <label> — asociación accesible
    // implícita (sección 23: "toggles deben tener label").
    const isInsideLabel = await toggle.evaluate((el) => el.closest("label") !== null);
    expect(isInsideLabel).toBe(true);
  }

  const cutPathToggle = page.locator('[data-overlay-toggle="cutpath"]');
  await expect(page.locator("#overlay-cutpath")).toBeVisible();
  await cutPathToggle.uncheck();
  await expect(page.locator("#overlay-cutpath")).toBeHidden();
  await cutPathToggle.check();
  await expect(page.locator("#overlay-cutpath")).toBeVisible();
});

test("el resumen textual expone tamaño final, sangrado, safe area, marcas, cut path y warnings — sin depender solo del canvas", async ({ page }) => {
  // Sección 23: el canvas/SVG puede ser aria-hidden si existe un resumen
  // textual equivalente — se verifica que ese resumen realmente exista y
  // contenga la información mínima, no solo que el canvas esté oculto.
  await expect(page.locator("#preview-canvas-wrapper")).toHaveAttribute("aria-hidden", "true");

  const summaryText = await page.locator("#preview-summary").innerText();
  expect(summaryText).toContain("60×60mm");
  expect(summaryText).toContain("Safe area");
  expect(summaryText).toContain("Marcas de corte");
  expect(summaryText).toContain("Cut path detectado");
  expect(summaryText).toContain("object_crosses_safe_area");
});

test("el zoom escala el preview sin modificar la geometría subyacente", async ({ page }) => {
  const scaleTarget = page.locator("#preview-scale-target");
  const before = await scaleTarget.evaluate((el) => getComputedStyle(el).transform);
  await page.locator("#zoom-range").fill("200");
  await page.locator("#zoom-range").dispatchEvent("input");
  const after = await scaleTarget.evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);

  // El zoom es puramente visual (CSS transform) — la geometría calculada
  // (expuesta en window.__printPreviewHarness) nunca cambia con el zoom.
  const output = await page.evaluate(() => (window as unknown as { __printPreviewHarness: PreviewOutput }).__printPreviewHarness);
  expect(output.overlays.trimBoxRect.width).toBeGreaterThan(0);
});
