import { defineConfig } from "vite";

export default defineConfig({
  // Vite ya resuelve el campo "browser" de Konva correctamente por defecto
  // en un build de cliente — a diferencia de Vitest (Node), no hace falta
  // forzar `resolve.mainFields` aquí (ver renderer-konva/vitest.config.ts).
  build: {
    outDir: "dist",
  },
});
