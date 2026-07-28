import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createKraftGenericLabelProject } from "./kraftGenericLabel.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createKraftGenericLabelProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 45mm especificado en TEMPLATE_BATCH_05.md", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 45, height: 45 });
  });

  it("tiene exactamente 4 objetos: die-line + wordmark + subtítulo + sello decorativo", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "wordmark", "subtitle", "decorative-seal"]);
  });

  it("el die-line usa el fill kraft (#F5EFE3), no el blanco por defecto — DEC-009", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#F5EFE3");
  });

  it("el sello decorativo no tiene relleno (solo stroke) y no excede el 20% del diámetro", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    const seal = objects.find((o) => o.metadata.role === "decorative-seal");
    expect(seal?.type).toBe("ellipse");
    if (seal?.type === "ellipse" && dieLine?.type === "ellipse") {
      expect(seal.style.fill).toBeUndefined();
      expect(seal.style.stroke).toBeTruthy();
      expect(seal.size.width).toBeLessThanOrEqual(dieLine.size.width * 0.2);
    }
  });

  it("no incluye ningún ImageObject — el sello es geometría vectorial, no ilustración", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("usa Lora para el wordmark y Work Sans para el subtítulo", () => {
    const project = createKraftGenericLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const wordmark = objects.find((o) => o.metadata.role === "wordmark");
    const subtitle = objects.find((o) => o.metadata.role === "subtitle");
    expect(wordmark?.type === "text" && wordmark.fontFamily).toBe("Lora");
    expect(subtitle?.type === "text" && subtitle.fontFamily).toBe("Work Sans");
  });
});
