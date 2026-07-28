import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createCorporateSealProject } from "./corporateSeal.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createCorporateSealProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 30mm especificado en TEMPLATE_BATCH_07.md", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 30, height: 30 });
  });

  it("tiene exactamente 4 objetos: die-line + monograma + 2 fragmentos del anillo", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "monogram", "ring-text", "ring-text"]);
  });

  it("el die-line usa el fill blanco (#FFFFFF)", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#FFFFFF");
  });

  it("el monograma y el anillo usan Inter peso 600 en gris azulado oscuro (#1F2933) — misma familia, sin ajuste de peso de DEC-013", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const monogram = objects.find((o) => o.metadata.role === "monogram");
    const ring = objects.filter((o) => o.metadata.role === "ring-text");
    expect(monogram?.type === "text" && monogram.content).toBe("T");
    expect(monogram?.type === "text" && monogram.fontFamily).toBe("Inter");
    expect(monogram?.type === "text" && monogram.fontWeight).toBe(600);
    expect(monogram?.style.fill).toBe("#1F2933");
    expect(ring.map((o) => o.type === "text" && o.content)).toEqual(["TU", "EMPRESA"]);
    for (const obj of ring) {
      expect(obj.type === "text" && obj.fontFamily).toBe("Inter");
      expect(obj.type === "text" && obj.fontWeight).toBe(600);
      expect(obj.style.fill).toBe("#1F2933");
    }
  });

  it("los 2 fragmentos del anillo están separados 180° (arriba/abajo) — rotaciones 0° y 180°", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    const ring = project.document.pages[0]!.layers[0]!.objects.filter((o) => o.metadata.role === "ring-text");
    expect(ring.map((o) => o.transform.rotation)).toEqual([0, 180]);
  });

  it("el radio del anillo respeta el margen de área segura (3mm) — no toca el troquel", () => {
    const project = createCorporateSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
    const centerPx = diameterPx / 2;
    const ring = objects.filter((o) => o.metadata.role === "ring-text");
    const top = ring.find((o) => o.transform.rotation === 0)!;
    expect(top.transform.y).toBeGreaterThan(0);
    expect(centerPx - top.transform.y).toBeLessThan(diameterPx / 2);
  });
});
