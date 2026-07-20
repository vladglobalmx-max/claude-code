import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Reutiliza el Chromium ya instalado en este entorno de desarrollo (ver
// PLAYWRIGHT_BROWSERS_PATH) en vez de que Playwright intente descargar su
// propio binario — si no existe (CI u otra máquina), cae al
// comportamiento normal de resolución de Playwright (undefined).
const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined);

/**
 * E2E/visual — separado de `vitest` (jsdom): estos tests necesitan un
 * navegador real porque comparan píxeles reales del canvas del editor
 * contra el PNG exportado (ver ADR-0012, condición 7 de la aprobación de
 * "reutilizar Konva vía Stage headless"). No corren en el pipeline de
 * `test` normal — `pnpm test:e2e` los ejecuta aparte, contra un build de
 * producción servido por `vite preview`.
 *
 * Epic 8 (Autosave, Recovery & Project Safety), sección 17: `vite preview`
 * sirve lo que ya esté en `dist/` — nada lo reconstruye por su cuenta. El
 * incidente detectado en Fase 7.4 (E2E corriendo contra un build viejo, sin
 * que nada lo advirtiera) se debió exactamente a esto. Por eso el script
 * `test:e2e` (`package.json`) es `"vite build && playwright test"`, nunca
 * `"playwright test"` a secas — un build fresco es una precondición del
 * comando, no un paso manual que alguien pueda olvidar.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath },
  },
  webServer: {
    command: "pnpm preview --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
