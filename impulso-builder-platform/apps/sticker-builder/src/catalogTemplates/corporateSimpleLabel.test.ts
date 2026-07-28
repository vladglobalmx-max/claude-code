import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createCorporateSimpleLabelProject } from "./corporateSimpleLabel.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createCorporateSimpleLabelProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el formato cuadrado de 40mm especificado en TEMPLATE_BATCH_05.md", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 40, height: 40 });
  });

  it("tiene exactamente 2 objetos: nombre de empresa + datos de contacto", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["company-name", "contact-info"]);
  });

  it("el bloque de nombre de empresa es puramente tipográfico — no un placeholder de logo gráfico", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.every((o) => o.type === "text")).toBe(true);
    expect(project.document.assets).toEqual([]);
  });

  it("usa Inter como única familia tipográfica", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    for (const obj of project.document.pages[0]!.layers[0]!.objects) {
      if (obj.type === "text") expect(obj.fontFamily).toBe("Inter");
    }
  });

  it("los datos de contacto quedan por debajo del nombre de empresa (retícula 66/34)", () => {
    const project = createCorporateSimpleLabelProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const name = objects.find((o) => o.metadata.role === "company-name");
    const contact = objects.find((o) => o.metadata.role === "contact-info");
    expect(contact!.transform.y).toBeGreaterThan(name!.transform.y);
  });
});
