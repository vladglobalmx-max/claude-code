import { describe, expect, it } from "vitest";
import { exportarSVG } from "./exportar.js";
import { crearPropuestas, generarLote } from "./generarLote.js";
import { interpretar } from "./intent.js";

function roleSignature(document: Awaited<ReturnType<typeof generarLote>>[number]["document"]): string {
  const roles = document.pages
    .flatMap((page) => page.layers.flatMap((layer) => layer.objects.map((object) => object.metadata.role ?? object.type)))
    .sort();
  return roles.join("|");
}

/** Corpus de frases reales de boda — cubre el caso canónico y los casos
 * límite de THOREN_CREATIVE_ENGINE.md §14 que esta fase debe tolerar sin
 * bloquear el flujo. */
const CORPUS = [
  "Etiquetas para la boda de Marcela y Andrés",
  "etiquetas para mi boda",
  "Boda. Marcela. Andrés.",
  "Sello para Marcela & Andrés el 15 de agosto de 2026",
  "etiketas pa la boda de Marcela y Andres, en dorado",
  "Boda de Rafael",
];

describe("generarLote", () => {
  it.each(CORPUS)("produce siempre 3 composiciones válidas y distintas para: %s", async (phrase) => {
    const intent = interpretar(phrase);
    const compositions = await generarLote(intent);

    expect(compositions).toHaveLength(3);
    expect(new Set(compositions.map((c) => c.archetypeId)).size).toBe(3);

    // "Estructuralmente distinta" — no basta cambiar posiciones: ninguna
    // pareja comparte exactamente el mismo conjunto de roles de objeto.
    const signatures = compositions.map((c) => roleSignature(c.document));
    expect(new Set(signatures).size).toBe(3);

    for (const composition of compositions) {
      const svg = await exportarSVG(composition.document);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.length).toBeGreaterThan(0);
    }
  });

  it("nunca dos arquetipos del mismo lote son el mismo tipo de estructura (circular / marco / asimétrica)", async () => {
    const compositions = await generarLote(interpretar("Boda de Marcela y Andrés"));
    const ids = compositions.map((c) => c.archetypeId);
    expect(ids).toContain("monograma-anillo");
    expect(ids).toContain("insignia-doble-filete");
    expect(ids).toContain("composicion-asimetrica");
  });
});

describe("crearPropuestas", () => {
  it("encadena interpretar + generarLote en una sola llamada", async () => {
    const compositions = await crearPropuestas("Etiquetas para la boda de Marcela y Andrés");
    expect(compositions).toHaveLength(3);
  });
});
