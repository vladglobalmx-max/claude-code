import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo motivo que renderer-konva/vitest.config.ts: Konva usa el campo
    // clásico "main" (Node, requiere `canvas`) vs "browser".
    mainFields: ["browser", "module", "main"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      // `printEngineHarness.ts`/`printPreviewHarness.ts` son harnesses
      // temporales de verificación (Fase 9.2/9.3, ver ADR-0022/ADR-0023) —
      // se ejercitan exclusivamente en Chromium real vía Playwright
      // (`e2e/print-engine.spec.ts`/`e2e/print-preview.spec.ts`), nunca
      // desde vitest. Sin esta exclusión quedan en 0% y arrastran la
      // cobertura de toda la app por debajo del umbral configurado
      // (detectado en Fase 9.5 — `pnpm test:coverage` nunca se había
      // corrido para esta app en un cierre de fase anterior).
      exclude: ["src/**/*.test.ts", "src/main.ts", "src/testing/**", "src/printEngineHarness.ts", "src/printPreviewHarness.ts"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
