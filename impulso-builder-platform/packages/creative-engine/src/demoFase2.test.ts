import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exportarSVG } from "./exportar.js";
import { crearPropuestas } from "./generarLote.js";

/**
 * Entregable demostrable de la Fase 2 (THOREN_IMPLEMENTATION_PLAN.md):
 * "se escribe una frase de boda real y aparecen tres SVGs genuinamente
 * generados, con el nombre correcto y composiciones visiblemente
 * distintas entre sí". Se ejecuta con `pnpm demo` y escribe los archivos
 * en demo-output/ para inspección visual directa.
 *
 * Nota de nomenclatura: la interfaz pública fijada por el plan es
 * `interpretar(frase) → Intent` + `generarLote(Intent) → Composition[]`
 * (dos pasos). `crearPropuestas` es solo el atajo de una llamada para este
 * demo — ver su comentario en generarLote.ts.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "demo-output");

describe("demo Fase 2 — Motor Creativo v1", () => {
  it("una sola frase produce tres propuestas reales, distintas y exportables", async () => {
    mkdirSync(outDir, { recursive: true });

    const compositions = await crearPropuestas("Etiquetas para la boda de Marcela y Andrés");
    expect(compositions).toHaveLength(3);

    for (const composition of compositions) {
      const svg = await exportarSVG(composition.document);
      writeFileSync(join(outDir, `boda-${composition.archetypeId}.svg`), svg, "utf-8");
      expect(svg.toLowerCase()).toContain("marcela");
      expect(svg.toLowerCase()).toContain("andrés");
    }
  });
});
