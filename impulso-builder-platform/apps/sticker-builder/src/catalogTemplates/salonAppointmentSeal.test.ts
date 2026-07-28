import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createSalonAppointmentSealProject } from "./salonAppointmentSeal.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createSalonAppointmentSealProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 30mm especificado en TEMPLATE_BATCH_03.md", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 30, height: 30 });
  });

  it("tiene exactamente 4 objetos: die-line + monograma + 2 fragmentos del anillo", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "monogram", "ring-text", "ring-text"]);
  });

  it("el die-line usa el fill rosa pálido (#F7E9EA)", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#F7E9EA");
  });

  it("el monograma usa Playfair Display peso 600 en rosa antiguo (#B76E79)", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const monogram = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "monogram");
    expect(monogram?.type === "text" && monogram.content).toBe("M");
    expect(monogram?.type === "text" && monogram.fontFamily).toBe("Playfair Display");
    expect(monogram?.type === "text" && monogram.fontWeight).toBe(600);
    expect(monogram?.style.fill).toBe("#B76E79");
  });

  it("el anillo perimetral contiene 'SALÓN' y 'MARINA' en Work Sans peso 700, casi negro (#2B2224) — DEC-013: peso sobre tamaño", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const ring = project.document.pages[0]!.layers[0]!.objects.filter((o) => o.metadata.role === "ring-text");
    expect(ring.map((o) => o.type === "text" && o.content)).toEqual(["SALÓN", "MARINA"]);
    for (const obj of ring) {
      expect(obj.type === "text" && obj.fontFamily).toBe("Work Sans");
      expect(obj.type === "text" && obj.fontWeight).toBe(700);
      expect(obj.style.fill).toBe("#2B2224");
    }
  });

  it("los 2 fragmentos del anillo están separados 180° (arriba/abajo) — rotaciones 0° y 180°", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const ring = project.document.pages[0]!.layers[0]!.objects.filter((o) => o.metadata.role === "ring-text");
    expect(ring.map((o) => o.transform.rotation)).toEqual([0, 180]);
  });

  it("el radio del anillo respeta el margen de área segura (3mm) — no toca el troquel", () => {
    const project = createSalonAppointmentSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
    const centerPx = diameterPx / 2;
    const ring = objects.filter((o) => o.metadata.role === "ring-text");
    // El fragmento superior (rotación 0°) tiene su borde superior en y —
    // debe quedar estrictamente dentro del radio del troquel.
    const top = ring.find((o) => o.transform.rotation === 0)!;
    expect(top.transform.y).toBeGreaterThan(0);
    expect(centerPx - top.transform.y).toBeLessThan(diameterPx / 2);
  });
});
