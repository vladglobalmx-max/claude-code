import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mismo motivo que `renderer-konva`/`apps/sticker-builder`: este paquete
  // depende transitivamente de Konva (vía `@impulso/export-engine` ->
  // `@impulso/renderer-konva`, para `ExportAssetResolver`/`sanitizeFilename`
  // hoy, y para el pipeline de raster desde Fase 9.2) — sin este override,
  // la resolución de módulos puede preferir el campo "main" de Konva (build
  // de Node, que requiere el paquete nativo `canvas`) en vez de "browser".
  resolve: {
    mainFields: ["browser", "module", "main"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testUtils/**"],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
