import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url)));

const monorepoPackages = fileURLToPath(new URL("../impulso-builder-platform/packages", import.meta.url));

/**
 * Fase 3 (Experience Integration, ver docs/product/THOREN_IMPLEMENTATION_PLAN.md):
 * el Motor Creativo real que vive detrás de esta Beta ES el paquete
 * `@impulso/creative-engine` aprobado en Fase 1/Fase 2 — no una
 * reimplementación. Este alias resuelve esos specifiers directamente
 * contra el código fuente TypeScript del monorepo (viven como directorios
 * hermanos en el mismo repositorio), y Vite lo transpila igual que
 * cualquier otro módulo. `@impulso/export-engine` se resuelve contra un
 * shim propio de este proyecto (ver src/vendor/) para no arrastrar Konva
 * al bundle del navegador — nunca se modifica ningún archivo del
 * monorepo para lograr esto.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@impulso/creative-engine": `${monorepoPackages}/creative-engine/src/index.ts`,
      "@impulso/document-schema": `${monorepoPackages}/document-schema/src/index.ts`,
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
