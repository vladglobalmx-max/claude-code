import { test, expect, type Page } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium, IndexedDB real — no jsdom) del
 * recorrido completo de 11 pasos del Template Piloto Oficial de THÖREN
 * (Serum Facial Premium, `TEMPLATE_BATCH_02.md` Template 7) acordado antes
 * de iniciar la implementación. Ver `THOREN_PILOT_TEMPLATE_STANDARD.md`
 * para el detalle completo de cada decisión y hallazgo; este spec es la
 * prueba de que el recorrido realmente funciona de punta a punta en un
 * navegador real, no solo en jsdom (que no tiene un Canvas 2D real —
 * `serumPilotFlow.test.ts`, en `src/catalogTemplates/`, cubre lo que sí se
 * puede probar sin un navegador).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
});

test("recorrido completo: galería -> crear -> editar -> guardar -> exportar PNG y SVG", async ({ page }) => {
  // Pasos 3-4 — el template ya está integrado en la Template Library
  // (sembrado por `seedCatalogTemplates`) y aparece en la galería de
  // "Nuevo proyecto" junto a los 3 built-in en blanco.
  await page.click(".workspace-new-btn");
  const serumCard = page.locator(".new-project-card", { hasText: "Serum Facial Premium" });
  await expect(serumCard).toBeVisible();
  // builtIn: true — sin botón de eliminar, mismo criterio que los 3
  // tamaños en blanco (ver catalogTemplates/index.ts).
  await expect(serumCard.locator(".new-project-card-delete")).toHaveCount(0);

  // Paso 5 — crear un proyecto real desde el template.
  await serumCard.click();
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#export-btn");

  // Paso 6 — el proyecto instanciado se edita con la UI normal del editor
  // (Capas + Inspector), sin ningún camino especial para templates.
  await page.click("#tab-layers");
  const layerRows = page.locator(".layer-row");
  await expect(layerRows).toHaveCount(6);
  const rowTexts = await layerRows.allTextContents();
  for (const expectedName of ["Línea de corte", "Wordmark", "Nombre del producto", "Línea divisoria", "% de activo", "Volumen"]) {
    expect(rowTexts.some((text) => text.includes(expectedName)), `falta la capa "${expectedName}" entre: ${rowTexts.join(", ")}`).toBe(true);
  }

  // Seleccionar el Wordmark y confirmar que el Inspector muestra su
  // contenido real (prueba que el TextObject sembrado es genuinamente
  // editable por la UI, no solo JSON válido).
  await layerRows.filter({ hasText: "Wordmark" }).click();
  const contentField = page.locator(".inspector-field").filter({ has: page.locator("> span:text-is('Contenido')") });
  const contentTextarea = contentField.locator("textarea");
  await expect(contentTextarea).toHaveValue("TU MARCA");

  // Editar el wordmark — un cambio de contenido real, como haría
  // cualquier comprador personalizando su etiqueta.
  await contentTextarea.fill("Aura Skincare");
  await contentTextarea.dispatchEvent("change");

  // Paso 7 — Guardarlo: el autosave (ya validado exhaustivamente en Epic 8,
  // `autosave-recovery.spec.ts`) es la vía real de guardado; este spec solo
  // confirma que, para ESTE proyecto específico, la transición ocurre.
  const saveStatusLabel = page.locator("#save-status .save-status-label");
  await expect(saveStatusLabel).toHaveText("Cambios sin guardar");
  await expect(saveStatusLabel).toHaveText("Guardado", { timeout: 5000 });

  // Paso 8 — Exportar PNG real (rasterización headless vía
  // @impulso/export-engine, la misma ruta que genera thumbnails).
  await page.click("#export-btn");
  await page.waitForSelector(".export-dialog-export");
  await page.click('.export-dialog-format input[value="png"]');
  await page.fill(".export-dialog-filename-input", "serum-piloto");
  const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
  const pngPath = await pngDownload.path();
  expect(pngPath).toBeTruthy();
  const pngBuffer = await import("node:fs").then((fs) => fs.promises.readFile(pngPath!));
  // Firma real de archivo PNG — confirma que el Blob descargado es un PNG
  // de verdad, no solo que el flujo de descarga se disparó.
  expect(pngBuffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  await page.click(".export-dialog-cancel");

  // Paso 9 — Exportar SVG real (núcleo puro de @impulso/export-engine,
  // ver buildSvgDocument).
  await page.click("#export-btn");
  await page.waitForSelector(".export-dialog-export");
  await page.click('.export-dialog-format input[value="svg"]');
  await page.fill(".export-dialog-filename-input", "serum-piloto");
  const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.click(".export-dialog-export")]);
  const svgPath = await svgDownload.path();
  expect(svgPath).toBeTruthy();
  const svgContent = await import("node:fs").then((fs) => fs.promises.readFile(svgPath!, "utf-8"));
  expect(svgContent).toContain("<svg");
  // El wordmark editado en el paso anterior debe reflejarse en el SVG
  // exportado — confirma que la edición realmente mutó el Project (no
  // solo la UI del Inspector) y que la exportación lee el estado real.
  expect(svgContent).toContain("Aura Skincare");
  expect(svgContent).toContain("Serum Vitamina C");
  await page.click(".export-dialog-cancel");
});

test("el thumbnail del template piloto se ve en 'Mis proyectos' tras crear y guardar", async ({ page }) => {
  await page.click(".workspace-new-btn");
  await page.locator(".new-project-card", { hasText: "Serum Facial Premium" }).click();
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#export-btn");

  const saveStatusLabel = page.locator("#save-status .save-status-label");
  await expect(saveStatusLabel).toHaveText("Guardado", { timeout: 5000 });

  await page.click("#back-to-workspace-btn");
  await page.waitForSelector(".workspace-card");
  // El proyecto recién creado a partir del template aparece en la
  // Workspace con su propio thumbnail — prueba que el ciclo completo
  // (crear desde template -> guardar -> listar en "Mis proyectos") no
  // depende de ningún caso especial para proyectos originados de un
  // template del catálogo de contenido.
  await expect(page.locator(".workspace-card-thumbnail").first()).toBeVisible();
});
