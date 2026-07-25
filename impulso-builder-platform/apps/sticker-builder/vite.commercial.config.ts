import { resolve } from "node:path";
import { defineConfig } from "vite";

/**
 * Build comercial (Fase 4.2, sección 26 de la autorización) — a propósito
 * SOLO compila `index.html`. `vite.config.ts` (el build normal, usado por
 * `pnpm dev`/`pnpm test:e2e`) también compila `print-engine-harness.html`
 * y `print-preview-harness.html` (harnesses de verificación de Epic 9,
 * ver ADR-0022/0023) — ninguno de los dos tiene ruta de producto ni debe
 * llegar nunca al paquete que recibe un comprador. En vez de compilar todo
 * y luego filtrar archivos (frágil: el chunking de Rollup podría dejar
 * código compartido en un chunk con nombre no obvio), este config nunca le
 * pide a Rollup que compile esos entrypoints — la exclusión queda
 * garantizada por construcción.
 */
export default defineConfig({
  build: {
    outDir: "dist-commercial-raw",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});
