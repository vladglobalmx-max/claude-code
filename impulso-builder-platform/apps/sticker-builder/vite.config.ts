import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Vite ya resuelve el campo "browser" de Konva correctamente por defecto
  // en un build de cliente — a diferencia de Vitest (Node), no hace falta
  // forzar `resolve.mainFields` aquí (ver renderer-konva/vitest.config.ts).
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        // Harness temporal de Epic 9 / Fase 9.2 (ver ADR-0022, sección
        // "Verificación en Chromium") — ejecuta el pipeline REAL de
        // `@impulso/print-engine` (Konva real, Canvas real, pdf-lib real)
        // dentro de un navegador real, sin mockear nada. Ninguna ruta de
        // producto lo referencia — se retira o se transforma en la UI
        // final de exportación a producción durante la Fase 9.4.
        printEngineHarness: resolve(__dirname, "print-engine-harness.html"),
        // Preview técnico temporal de Fase 9.3 (ver ADR-0023, sección 22) —
        // mismo estatus que el harness de arriba: sin ruta de producto.
        printPreviewHarness: resolve(__dirname, "print-preview-harness.html"),
      },
    },
  },
});
