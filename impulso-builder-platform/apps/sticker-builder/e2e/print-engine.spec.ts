import { test, expect } from "@playwright/test";

/**
 * Verificación en Chromium real del pipeline de `@impulso/print-engine`
 * (Epic 9 / Fase 9.2, ver ADR-0022 y sección 21 del enunciado de la fase)
 * — visita el harness temporal (`print-engine-harness.html` /
 * `src/printEngineHarness.ts`, ver comentarios ahí) que ejercita Konva
 * real, `HTMLCanvasElement`/`Image`/`createImageBitmap` reales y
 * `pdf-lib` real, sin ningún mock — a diferencia de los tests unitarios
 * jsdom del paquete, que mockean la rasterización para aislar la
 * orquestación.
 *
 * Este harness no es una ruta de producto — no hay ningún flujo real que
 * navegue aquí. Se retira o se transforma en la UI real de exportación a
 * producción durante la Fase 9.4.
 */

interface ScenarioResult {
  pass?: boolean;
  error?: string;
  [key: string]: unknown;
}

interface HarnessOutput {
  allPass: boolean;
  results: Record<string, ScenarioResult>;
}

test("los 12 escenarios de verificación en Chromium de Fase 9.2 pasan con el pipeline real (sin mocks)", async ({ page }) => {
  await page.goto("/print-engine-harness.html");

  await page.waitForFunction(() => (window as unknown as { __printEngineHarnessResults?: unknown }).__printEngineHarnessResults !== undefined, {
    timeout: 20_000,
  });

  const output = await page.evaluate(() => (window as unknown as { __printEngineHarnessResults: HarnessOutput }).__printEngineHarnessResults);

  for (const [name, result] of Object.entries(output.results)) {
    expect(result.error, `escenario "${name}" lanzó un error inesperado: ${result.error}`).toBeUndefined();
    expect(result.pass, `escenario "${name}" no pasó — resultado: ${JSON.stringify(result)}`).toBe(true);
  }

  expect(output.allPass).toBe(true);
});
