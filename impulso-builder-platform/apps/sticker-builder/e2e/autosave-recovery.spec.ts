import { test, expect, type Page } from "@playwright/test";

/**
 * Verificación en navegador real (Chromium, IndexedDB de verdad — no
 * jsdom) de EPIC 8 (Autosave, Recovery & Project Safety): el indicador de
 * guardado se actualiza sin presionar Guardar, un cierre/recarga bien
 * antes del autosave principal deja un recovery recuperable desde la
 * Workspace, "Mis proyectos" no advierte innecesariamente una vez que el
 * autosave ya terminó (y la miniatura queda actualizada), y Guardar manual
 * (Ctrl+S) persiste de inmediato. Los casos de concurrencia/errores en sí
 * (debounce, races, cuota, IndexedDB caído) ya están probados
 * exhaustivamente en `packages/project-library/src/saveCoordinator.test.ts`
 * (vitest, temporizadores falsos) — este spec solo confirma que el
 * cableado real del navegador (IndexedDB real, recarga real de página)
 * funciona.
 */

async function openBlankProject(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForSelector(".workspace-new-btn");
  await page.click(".workspace-new-btn");
  await page.waitForSelector(".new-project-card-custom");
  await page.click(".new-project-card-custom");
  await page.fill(".new-project-dialog-width", "50");
  await page.fill(".new-project-dialog-height", "50");
  await page.click(".new-project-dialog-create");
  await page.waitForSelector("#export-btn");
}

/** Sube un PNG de color sólido generado por el propio `<canvas>` del
 * navegador — mismo técnica que `multi-selection.spec.ts`/
 * `export-visual.spec.ts`. Cualquier color sirve: solo hace falta un
 * cambio de contenido real (un `projectChanged` del Engine) que ensucie el
 * `ProjectSaveCoordinator`. */
async function insertSolidColorImage(page: Page, color: string): Promise<void> {
  const dataUrl = await page.evaluate((fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png");
  }, color);
  const buffer = Buffer.from(dataUrl.split(",")[1]!, "base64");
  await page.locator(".tool-image-input").setInputFiles({ name: `solid-${color.replace("#", "")}.png`, mimeType: "image/png", buffer });
  await page.waitForTimeout(150);
}

function saveStatusLabel(page: Page) {
  return page.locator("#save-status .save-status-label");
}

test("el indicador de guardado pasa de 'Cambios sin guardar' a 'Guardado' automáticamente, sin presionar Guardar", async ({ page }) => {
  await openBlankProject(page);
  await insertSolidColorImage(page, "#22c55e");

  await expect(saveStatusLabel(page)).toHaveText("Cambios sin guardar");
  // Nunca se hace clic en el botón Guardar en este test — el autosave
  // (debounce ~1200ms) es el único responsable de esta transición.
  await expect(saveStatusLabel(page)).toHaveText("Guardado", { timeout: 5000 });
});

test("'Mis proyectos' tras un autosave exitoso navega sin advertencias y la Workspace muestra la miniatura actualizada", async ({ page }) => {
  await openBlankProject(page);
  await insertSolidColorImage(page, "#3b82f6");
  await expect(saveStatusLabel(page)).toHaveText("Guardado", { timeout: 5000 });

  await page.click("#back-to-workspace-btn");
  // Sin diálogo de "cambios sin guardar": el Project ya estaba limpio.
  await page.waitForSelector(".workspace-card");
  expect(await page.locator(".unsaved-changes-dialog-overlay").isVisible()).toBe(false);

  const thumbnailSrc = await page.locator(".workspace-card-thumbnail").first().getAttribute("src");
  expect(thumbnailSrc).toMatch(/^blob:/);
});

test("Guardar manual (Ctrl+S) persiste de inmediato y no deja ningún recovery pendiente", async ({ page }) => {
  await openBlankProject(page);
  await insertSolidColorImage(page, "#a855f7");
  await expect(saveStatusLabel(page)).toHaveText("Cambios sin guardar");

  await page.keyboard.press("Control+s");
  await expect(saveStatusLabel(page)).toHaveText("Guardado");

  await page.reload();
  await page.waitForSelector(".workspace-card");
  // El guardado manual ya limpió el recovery — no debe aparecer el banner.
  await expect(page.locator(".workspace-recovery-banner")).toBeHidden();
});

test("recargar la página bien antes del autosave principal ofrece recuperar los cambios desde la Workspace", async ({ page }) => {
  await openBlankProject(page);
  await insertSolidColorImage(page, "#0ea5e9");

  // El recovery rápido (~400ms, independiente del autosave principal de
  // ~1200ms — ver ADR de Autosave/Recovery) ya debería existir a esta
  // altura; el autosave principal todavía no corrió, así que este Project
  // (nunca guardado) solo es recuperable vía el banner de recovery.
  await page.waitForTimeout(700);
  await page.reload();

  await page.waitForSelector(".workspace-recovery-banner");
  await expect(page.locator(".workspace-recovery-row")).toHaveCount(1);
  await expect(page.locator(".workspace-recovery-recover")).toBeVisible();
  // Nunca se guardó de verdad — no existe ninguna "versión guardada" que ofrecer.
  await expect(page.locator(".workspace-recovery-open-saved")).toHaveCount(0);
  // Tampoco debería haber ninguna tarjeta de proyecto todavía.
  await expect(page.locator(".workspace-card")).toHaveCount(0);

  await page.click(".workspace-recovery-recover");
  await page.waitForSelector("#export-btn");
  // El Project recuperado se abre con sus cambios (no en blanco) y como
  // "dirty" (arranca su propio ciclo de guardado, ver Epic 8 sección 3).
  await expect(page.locator(".layer-row")).toHaveCount(1);
  await expect(saveStatusLabel(page)).toHaveText(/Cambios sin guardar|Guardando…/);
});
