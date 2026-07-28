import { describe, expect, it } from "vitest";
import { validateProject, toPixels } from "@impulso/document-schema";
import { createSpaWellnessProject } from "./spaWellness.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createSpaWellnessProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el formato rectangular de 100mm x 50mm especificado en TEMPLATE_BATCH_03.md", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    const page = project.document.pages[0]!;
    expect(page.size).toEqual({ width: 100, height: 50 });
  });

  it("no agrega ningún object de línea de corte — el troquel es el borde de la página (forma rectangular)", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.metadata.role === "die-line")).toBe(false);
  });

  it("tiene exactamente 3 objetos: nombre + línea divisoria + subtítulo", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["name", "divider", "subtitle"]);
  });

  it("la línea divisoria no excede el 30% del ancho total (Layout del batch)", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    const divider = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "divider");
    expect(divider?.type).toBe("rectangle");
    if (divider?.type === "rectangle") {
      expect(divider.size.width).toBeLessThanOrEqual(toPixels(100, "mm") * 0.3);
    }
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("usa Work Sans como única familia tipográfica", () => {
    const project = createSpaWellnessProject({ now: NOW, generateId });
    for (const obj of project.document.pages[0]!.layers[0]!.objects) {
      if (obj.type === "text") expect(obj.fontFamily).toBe("Work Sans");
    }
  });
});
