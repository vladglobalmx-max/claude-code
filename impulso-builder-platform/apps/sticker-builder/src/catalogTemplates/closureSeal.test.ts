import { describe, expect, it } from "vitest";
import { validateProject, toPixels } from "@impulso/document-schema";
import { createClosureSealProject } from "./closureSeal.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createClosureSealProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 25mm especificado en TEMPLATE_BATCH_06.md", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 25, height: 25 });
  });

  it("tiene exactamente 3 objetos: die-line + borde decorativo + wordmark", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "decorative-border", "wordmark"]);
  });

  it("el borde decorativo es un EllipseObject sin relleno, concéntrico al troquel", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    const border = objects.find((o) => o.metadata.role === "decorative-border");
    expect(border?.type).toBe("ellipse");
    if (border?.type === "ellipse" && dieLine?.type === "ellipse") {
      expect(border.style.fill).toBeUndefined();
      expect(border.style.stroke).toBeTruthy();
      expect(border.size.width).toBeLessThan(dieLine.size.width);
      // Concéntrico: mismo centro que el troquel (die-line en 0,0 con su
      // propio tamaño; el borde debe quedar centrado dentro de él).
      const dieLineCenter = dieLine.transform.x + dieLine.size.width / 2;
      const borderCenter = border.transform.x + border.size.width / 2;
      expect(borderCenter).toBeCloseTo(dieLineCenter, 6);
    }
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("la línea de corte cubre el diámetro real de 25mm en px canónico", () => {
    const project = createClosureSealProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    if (dieLine?.type === "ellipse") {
      expect(dieLine.size).toEqual({ width: toPixels(25, "mm"), height: toPixels(25, "mm") });
    }
  });
});
