import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

const vendoredEngine = fileURLToPath(new URL("./src/vendor/engine", import.meta.url));

/**
 * El Motor Creativo real que vive detrás de esta Beta ES el motor
 * aprobado en Fase 1/Fase 2 (ver docs/product/THOREN_STICKER_BUILDER_COMPONENT.md
 * y docs/product/THOREN_IMPLEMENTATION_PLAN.md del monorepo Impulso) — no
 * una reimplementación. `thoren-beta` es un proyecto web independiente
 * (no depende de Claude, Artifacts, ni de ningún otro repositorio): estos
 * alias resuelven los specifiers contra una copia vendorizada y congelada
 * del código fuente TypeScript de ese motor, ya incluida en este mismo
 * repositorio (`src/vendor/engine/`). Vite la transpila igual que
 * cualquier otro módulo del proyecto. `@impulso/export-engine` se resuelve
 * contra un shim propio (ver src/vendor/) para no arrastrar Konva al
 * bundle del navegador.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@impulso/creative-engine": `${vendoredEngine}/creative-engine/src/index.ts`,
      "@impulso/document-schema": `${vendoredEngine}/document-schema/src/index.ts`,
      "@impulso/export-engine": fileURLToPath(new URL("./src/vendor/exportEngineSvgOnly.js", import.meta.url)),
      "node:crypto": fileURLToPath(new URL("./src/vendor/nodeCryptoShim.js", import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: "es2018",
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.js"],
  },
});
