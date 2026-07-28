import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createHomemadeStampProject } from "./homemadeStamp.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createHomemadeStampProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createHomemadeStampProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 35mm especificado en TEMPLATE_BATCH_05.md", () => {
    const project = createHomemadeStampProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 35, height: 35 });
  });

  it("tiene exactamente 2 objetos: die-line + texto principal — sin anillo (DEC-012)", () => {
    const project = createHomemadeStampProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "main-text"]);
  });

  it("el die-line usa el fill crema (#F5EEDD) — DEC-009", () => {
    const project = createHomemadeStampProject({ now: NOW, generateId });
    const dieLine = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.style.fill).toBe("#F5EEDD");
  });

  it("el texto principal es 'Hecho en casa' en Caveat, marrón cálido (#8B5E3C)", () => {
    const project = createHomemadeStampProject({ now: NOW, generateId });
    const text = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "main-text");
    expect(text?.type === "text" && text.content).toBe("Hecho en casa");
    expect(text?.type === "text" && text.fontFamily).toBe("Caveat");
    expect(text?.style.fill).toBe("#8B5E3C");
  });
});
