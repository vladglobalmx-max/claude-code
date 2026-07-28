import { test, expect } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium) del Lote 2 del catálogo de
 * contenido (`THOREN_CATALOG_PRODUCTION_PLAN_v1.md`) — 5 templates "cero
 * ilustración, con marco/textura/logo", mismo patrón parametrizado que
 * `template-catalog-lote1.spec.ts`. Introduce dos capacidades nuevas
 * frente al Lote 1: el `fill` kraft del die-line (DEC-009) y el
 * placeholder de logo del usuario (Empaque Artesanal Etsy) — ambos se
 * verifican indirectamente aquí vía exportación PNG/SVG real, ya que
 * ambos son objetos reales del `Project` (rectángulo/elipse con estilo),
 * no atajos de renderizado.
 */

interface Lote2Case {
  name: string;
  expectedLayerCount: number;
}

const LOTE_2_CASES: Lote2Case[] = [
  { name: "Etiqueta Kraft Genérica", expectedLayerCount: 4 },
  { name: "Etiqueta Corporativa Simple", expectedLayerCount: 2 },
  { name: "Sello de Regalo Hecho a Mano", expectedLayerCount: 3 },
  { name: "Kraft Hecho a Mano", expectedLayerCount: 2 },
  { name: "Empaque Artesanal Etsy", expectedLayerCount: 2 },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
});

for (const { name, expectedLayerCount } of LOTE_2_CASES) {
  test(`Lote 2 — ${name}: galería -> crear -> Capas -> guardar -> exportar PNG y SVG`, async ({ page }) => {
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

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="png"]');
    await page.fill(".export-dialog-filename-input", "lote2-export");
    const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const pngPath = await pngDownload.path();
    expect(pngPath).toBeTruthy();
    const pngBuffer = await import("node:fs").then((fs) => fs.promises.readFile(pngPath!));
    expect(pngBuffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    await page.click(".export-dialog-cancel");

    await page.click("#export-btn");
    await page.waitForSelector(".export-dialog-export");
    await page.click('.export-dialog-format input[value="svg"]');
    await page.fill(".export-dialog-filename-input", "lote2-export");
    const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
    const svgPath = await svgDownload.path();
    expect(svgPath).toBeTruthy();
    const svgContent = await import("node:fs").then((fs) => fs.promises.readFile(svgPath!, "utf-8"));
    expect(svgContent).toContain("<svg");
    await page.click(".export-dialog-cancel");
  });
}
