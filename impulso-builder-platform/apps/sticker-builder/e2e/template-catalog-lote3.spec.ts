import { test, expect } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium) del Lote 3 del catálogo de
 * contenido (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`) — 4 sellos circulares,
 * mismo patrón parametrizado que `template-catalog-lote1.spec.ts` /
 * `template-catalog-lote2.spec.ts`. Introduce `arrangeRingText` (anillo de
 * texto perimetral de 360°), usada por 2 de los 4 (Sello de Cita — Salón
 * de Belleza, Sello Corporativo); los otros 2 (Sello "Hecho en Casa",
 * Sello de Sobre de Invitación) resultaron ser sellos de un solo elemento
 * central sin anillo real al leer su especificación completa (ver
 * `THOREN_DECISION_LOG.md` DEC-012) y reutilizan patrones ya aprobados.
 * El primer template en usar `arrangeRingText` (Sello de Cita) se sometió
 * además a `THOREN_VISUAL_ACCEPTANCE.md` con una captura de pantalla real
 * del canvas, no solo la exportación automatizada de PNG/SVG.
 */

interface Lote3Case {
  name: string;
  expectedLayerCount: number;
}

const LOTE_3_CASES: Lote3Case[] = [
  { name: "Sello de Cita — Salón de Belleza", expectedLayerCount: 4 },
  { name: "Sello Corporativo", expectedLayerCount: 4 },
  { name: "Sello \"Hecho en Casa\"", expectedLayerCount: 2 },
  { name: "Sello de Sobre de Invitación", expectedLayerCount: 2 },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
});

for (const { name, expectedLayerCount } of LOTE_3_CASES) {
  test(`Lote 3 — ${name}: galería -> crear -> Capas -> guardar -> exportar PNG y SVG`, async ({ page }) => {
    await page.click(".workspace-new-btn");
    const card = page.locator(".new-project-card", { hasText: name });
    await expect(card).toBeVisible();
    await expect(card.locator(".new-project-card-delete")).toHaveCount(0);

    await card.click();
    await page.click(".new-project-dialog-create");
    await page.waitForSelector("#export-btn");

    await page.click("#tab-layers");
    const layerRows = page.locator(".layer-row");
    await expect(layerRows).toHaveCount(expectedLayerCount);

    const saveStatusLabel = page.locator("#save-status .save-status-label");
    await expect(saveStatusLabel).toHaveText("Guardado", { timeout: 5000 });

    // Captura real del canvas — insumo para la revisión humana de
    // `THOREN_VISUAL_ACCEPTANCE.md` (primer template con `arrangeRingText`).
    await page.locator("#canvas-runtime").screenshot({ path: `test-results/visual-acceptance-${name.replace(/[^a-z0-9]+/gi, "-")}.png` });

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="png"]');
    await page.fill(".export-dialog-filename-input", "lote3-export");
    const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();
    const pngBuffer = await import("node:fs").then((fs) => fs.promises.readFile(pngPath!));
    expect(pngBuffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await pngDownload.saveAs(`test-results/visual-acceptance-${name.replace(/[^a-z0-9]+/gi, "-")}.exported.png`);
    await page.click(".export-dialog-cancel");

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="svg"]');
    await page.fill(".export-dialog-filename-input", "lote3-export");
    const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const svgPath = await svgDownload.path();
    expect(svgPath).toBeTruthy();
    const svgContent = await import("node:fs").then((fs) => fs.promises.readFile(svgPath!, "utf-8"));
    expect(svgContent).toContain("<svg");
    await svgDownload.saveAs(`test-results/visual-acceptance-${name.replace(/[^a-z0-9]+/gi, "-")}.exported.svg`);
    await page.click(".export-dialog-cancel");
  });
}
