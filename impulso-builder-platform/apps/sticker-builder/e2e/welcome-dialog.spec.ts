import { test, expect } from "@playwright/test";

/**
 * Verificación en Chromium real de la bienvenida de primera ejecución
 * (Fase 4.2, sección 12). `playwright.config.ts` siembra `localStorage`
 * globalmente marcando la bienvenida como "ya vista" (para no interferir
 * con el resto de la suite) — este spec necesita justamente el estado
 * contrario, así que arranca sin ese `storageState` para ver la
 * bienvenida real, tal como la vería un comprador nuevo.
 *
 * Regresión de Release Candidate 1.0 (validación de comprador): el
 * título del diálogo recibe foco programático al abrirse (para que
 * lectores de pantalla lo anuncien) — sin un estilo de foco propio, el
 * navegador dibujaba su contorno por defecto (un recuadro crudo, sin
 * relación con el diseño) alrededor del título, justo en la primera
 * pantalla que ve un comprador. Corregido con un estilo de foco coherente
 * con el resto de la app (mismo tratamiento que `.alignment-button`).
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("la bienvenida aparece en el primer uso, con el título anunciado por foco pero SIN el contorno crudo del navegador", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".welcome-dialog-close", { timeout: 10000 });

  const title = page.locator(".welcome-dialog h2");
  await expect(title).toBeFocused(); // el foco programático sigue funcionando (accesibilidad intacta)

  const outline = await title.evaluate((el) => getComputedStyle(el).outline);
  // El contorno por defecto de Chromium para `outline: auto` reporta
  // "rgb(x, x, x) auto Npx" — la regresión real mostraba exactamente ese
  // patrón. El estilo corregido es un contorno sólido explícito, nunca
  // "auto", y nunca completamente ausente (el indicador de foco no se
  // elimina, solo se reemplaza).
  expect(outline).not.toContain("auto");
  expect(outline).not.toBe("none");
});

test("Tab/Escape siguen funcionando con normalidad tras el fix de estilo del foco", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".welcome-dialog-close", { timeout: 10000 });

  // El título tiene tabIndex=-1 (no es una parada de Tab) — Tab desde el
  // estado inicial debe ir directo al único elemento interactivo real.
  await page.keyboard.press("Tab");
  await expect(page.locator(".welcome-dialog-close")).toBeFocused();

  // Escape sigue cerrando el diálogo con normalidad.
  await page.keyboard.press("Escape");
  await expect(page.locator(".welcome-dialog-overlay")).toBeHidden();
});
