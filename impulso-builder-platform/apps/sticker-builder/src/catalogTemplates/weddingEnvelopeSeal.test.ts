import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createWeddingEnvelopeSealProject } from "./weddingEnvelopeSeal.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createWeddingEnvelopeSealProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createWeddingEnvelopeSealProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 25mm especificado en TEMPLATE_BATCH_08.md", () => {
    const project = createWeddingEnvelopeSealProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 25, height: 25 });
  });

  it("tiene exactamente 2 objetos: die-line + iniciales — sin anillo (DEC-012)", () => {
    const project = createWeddingEnvelopeSealProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "monogram"]);
  });

  it("el die-line usa el fill blanco (#FFFFFF)", () => {
    const project = createWeddingEnvelopeSealProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#FFFFFF");
  });

  it("las iniciales son 'M & J' en Parisienne, dorado (#D4AF37) — sin itálica (limitación de schema)", () => {
    const project = createWeddingEnvelopeSealProject({ now: NOW, generateId });
    const monogram = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "monogram");
    expect(monogram?.type === "text" && monogram.content).toBe("M & J");
    expect(monogram?.type === "text" && monogram.fontFamily).toBe("Parisienne");
    expect(monogram?.style.fill).toBe("#D4AF37");
  });
});
