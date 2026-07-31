import { DocumentSchema } from "@impulso/document-schema";
import { describe, expect, it } from "vitest";
import { composicionAsimetrica, insigniaEnmarcada, monogramaAnillo } from "./archetypes/index.js";
import { exportarSVG } from "./exportar.js";
import { interpretar } from "./intent.js";
import { RECIPE_ELEGANTE_BODA } from "./recipes/eleganteBoda.js";

const NOW = "2026-07-30T00:00:00.000Z";
const INTENT = interpretar("Etiquetas para la boda de Marcela y Andrés");

describe("arquetipos de la receta Elegante-Boda", () => {
  it("cada uno produce un Document válido contra @impulso/document-schema", () => {
    for (const archetype of RECIPE_ELEGANTE_BODA.archetypes) {
      const draft = archetype.build(INTENT, RECIPE_ELEGANTE_BODA, NOW);
      expect(() => DocumentSchema.parse(draft)).not.toThrow();
    }
  });

  it("monograma-anillo: circular, con anillo de texto — sin marco rectangular", () => {
    const document = DocumentSchema.parse(monogramaAnillo.build(INTENT, RECIPE_ELEGANTE_BODA, NOW));
    const objects = document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.type === "ellipse")).toBe(true);
    expect(objects.some((o) => o.type === "rectangle" && o.metadata.role !== "background")).toBe(false);
    // anillo (4 fragmentos) + monograma = 5 objetos de texto
    expect(objects.filter((o) => o.type === "text")).toHaveLength(5);
  });

  it("insignia-doble-filete: dos marcos rectangulares concéntricos — sin círculo", () => {
    const document = DocumentSchema.parse(insigniaEnmarcada.build(INTENT, RECIPE_ELEGANTE_BODA, NOW));
    const objects = document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.type === "ellipse")).toBe(false);
    const frames = objects.filter((o) => o.type === "rectangle" && o.style.fill === undefined);
    expect(frames).toHaveLength(2);
  });

  it("composicion-asimetrica: sin marco cerrado de ningún tipo, texto alineado a la izquierda", () => {
    const document = DocumentSchema.parse(composicionAsimetrica.build(INTENT, RECIPE_ELEGANTE_BODA, NOW));
    const objects = document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.type === "ellipse")).toBe(false);
    expect(objects.some((o) => o.type === "rectangle" && o.style.fill === undefined)).toBe(false);
    const nameText = objects.find((o) => o.type === "text" && o.metadata.role === "nombre");
    expect(nameText).toBeDefined();
    if (nameText?.type === "text") expect(nameText.textAlign).toBe("left");
  });

  it("los tres arquetipos exportan a SVG determinista y estable (snapshot)", async () => {
    for (const archetype of RECIPE_ELEGANTE_BODA.archetypes) {
      const document = DocumentSchema.parse(archetype.build(INTENT, RECIPE_ELEGANTE_BODA, NOW));
      const svg = await exportarSVG(document);
      await expect(svg).toMatchFileSnapshot(`./__snapshots__/${archetype.id}.svg`);
    }
  });
});
