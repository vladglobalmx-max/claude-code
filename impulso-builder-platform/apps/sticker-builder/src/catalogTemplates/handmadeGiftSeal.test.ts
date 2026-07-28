import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createHandmadeGiftSealProject } from "./handmadeGiftSeal.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createHandmadeGiftSealProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 35mm especificado en TEMPLATE_BATCH_09.md", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 35, height: 35 });
  });

  it("tiene exactamente 3 objetos: die-line + texto fijo + campo de nombre", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "fixed-text", "name"]);
  });

  it("el die-line usa el fill kraft (#F5EFE3) — DEC-009", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#F5EFE3");
  });

  it("el acento rojo (#C0392B) se usa únicamente en el campo de nombre, nunca en el texto fijo", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const fixedText = objects.find((o) => o.metadata.role === "fixed-text");
    const name = objects.find((o) => o.metadata.role === "name");
    expect(name?.style.fill).toBe("#C0392B");
    expect(fixedText?.style.fill).not.toBe("#C0392B");
  });

  it("usa Caveat, una tipografía script cálida", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    for (const obj of project.document.pages[0]!.layers[0]!.objects) {
      if (obj.type === "text") expect(obj.fontFamily).toBe("Caveat");
    }
  });

  it("el contenido del texto fijo coincide con el ejemplo literal del batch", () => {
    const project = createHandmadeGiftSealProject({ now: NOW, generateId });
    const fixedText = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "fixed-text");
    expect(fixedText?.type === "text" && fixedText.content).toBe("Hecho con cariño por...");
  });
});
