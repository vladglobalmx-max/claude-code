import { test, expect } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium) del Lote 1 del catálogo de
 * contenido (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`) — 5 templates "cero
 * ilustración, layout puro" construidos enteramente sobre
 * `catalogTemplates/kit/`, sin ningún componente nuevo. Parametrizado en
 * vez de duplicar el spec completo de 11 pasos por template (ya cubierto
 * una vez para el piloto en `template-catalog-pilot.spec.ts`): cada
 * template se verifica en galería, creación, panel de Capas (conteo real
 * de objetos), guardado y exportación PNG/SVG reales.
 */

interface Lote1Case {
  name: string;
  expectedLayerCount: number;
}

const LOTE_1_CASES: Lote1Case[] = [
  { name: "Bálsamo Labial Natural", expectedLayerCount: 3 },
  { name: "Spa & Bienestar", expectedLayerCount: 3 },
  { name: "Etiqueta Neutral Minimalista", expectedLayerCount: 3 },
  { name: "Sello de Cierre", expectedLayerCount: 3 },
  { name: "Gracias por tu Preferencia", expectedLayerCount: 2 },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
});

for (const { name, expectedLayerCount } of LOTE_1_CASES) {
  test(`Lote 1 — ${name}: galería -> crear -> Capas -> guardar -> exportar PNG y SVG`, async ({ page }) => {
    await page.click(".workspace-new-btn");
    const card = page.locator(".new-project-card", { hasText: name });
    await expect(card).toBeVisible();
    // builtIn: true — sin botón de eliminar, mismo criterio que el piloto
    // y que los 3 tamaños en blanco.
    await expect(card.locator(".new-project-card-delete")).toHaveCount(0);

    await card.click();
    await page.click(".new-project-dialog-create");
    await page.waitForSelector("#export-btn");

    await page.click("#tab-layers");
    const layerRows = page.locator(".layer-row");
    await expect(layerRows).toHaveCount(expectedLayerCount);

    const saveStatusLabel = page.locator("#save-status .save-status-label");
    await expect(saveStatusLabel).toHaveText("Guardado", { timeout: 5000 });

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="png"]');
    await page.fill(".export-dialog-filename-input", "lote1-export");
    const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();
    const pngBuffer = await import("node:fs").then((fs) => fs.promises.readFile(pngPath!));
    expect(pngBuffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await page.click(".export-dialog-cancel");

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="svg"]');
    await page.fill(".export-dialog-filename-input", "lote1-export");
    const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const svgPath = await svgDownload.path();
    expect(svgPath).toBeTruthy();
    const svgContent = await import("node:fs").then((fs) => fs.promises.readFile(svgPath!, "utf-8"));
    expect(svgContent).toContain("<svg");
    await page.click(".export-dialog-cancel");
  });
}
