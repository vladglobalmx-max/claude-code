import { describe, expect, it } from "vitest";
import { validateProject, toPixels } from "@impulso/document-schema";
import { createNeutralMinimalLabelProject } from "./neutralMinimalLabel.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createNeutralMinimalLabelProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el formato rectangular de 75mm x 30mm especificado en TEMPLATE_BATCH_05.md", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 75, height: 30 });
  });

  it("tiene exactamente 3 objetos: wordmark + línea divisoria + subtítulo", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["wordmark", "divider", "subtitle"]);
  });

  it("reutiliza exactamente la paleta del Serum Facial Premium (carbón #23282B)", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const wordmark = objects.find((o) => o.metadata.role === "wordmark");
    expect(wordmark?.style.fill).toBe("#23282B");
  });

  it("la línea divisoria no excede el 40% del ancho total (Layout del batch)", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    const divider = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "divider");
    expect(divider?.type).toBe("rectangle");
    if (divider?.type === "rectangle") {
      expect(divider.size.width).toBeLessThanOrEqual(toPixels(75, "mm") * 0.4);
    }
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createNeutralMinimalLabelProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });
});
