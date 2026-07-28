import { describe, expect, it } from "vitest";
import { validateProject, toPixels } from "@impulso/document-schema";
import { createLipBalmNaturalProject } from "./lipBalmNatural.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createLipBalmNaturalProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 20mm especificado en TEMPLATE_BATCH_03.md", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const page = project.document.pages[0]!;
    expect(page.size).toEqual({ width: 20, height: 20 });
    expect(page.unit).toBe("mm");
  });

  it("tiene exactamente 3 objetos: die-line + sabor + wordmark", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "flavor", "wordmark"]);
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("usa Quicksand como única familia tipográfica", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const textObjects = project.document.pages[0]!.layers[0]!.objects.filter((o) => o.type === "text");
    expect(textObjects.length).toBeGreaterThan(0);
    for (const obj of textObjects) {
      if (obj.type === "text") expect(obj.fontFamily).toBe("Quicksand");
    }
  });

  it("el sabor usa una fuente notablemente mayor que el wordmark de marca (Layout del batch)", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const flavor = objects.find((o) => o.metadata.role === "flavor");
    const wordmark = objects.find((o) => o.metadata.role === "wordmark");
    expect(flavor?.type === "text" && flavor.fontSize).toBeGreaterThan(wordmark?.type === "text" ? wordmark.fontSize : 0);
  });

  it("la línea de corte cubre el diámetro real de 20mm en px canónico", () => {
    const project = createLipBalmNaturalProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.type).toBe("ellipse");
    if (dieLine?.type === "ellipse") {
      expect(dieLine.size).toEqual({ width: toPixels(20, "mm"), height: toPixels(20, "mm") });
    }
  });

  it("genera ids frescos en cada llamada", () => {
    const first = createLipBalmNaturalProject({ now: NOW, generateId });
    const second = createLipBalmNaturalProject({ now: NOW, generateId });
    expect(first.id).not.toBe(second.id);
  });
});
