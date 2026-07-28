import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createKraftHandmadeEtsyProject } from "./kraftHandmadeEtsy.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createKraftHandmadeEtsyProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createKraftHandmadeEtsyProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 45mm especificado en TEMPLATE_BATCH_09.md (mismo tamaño que Kraft Genérica)", () => {
    const project = createKraftHandmadeEtsyProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 45, height: 45 });
  });

  it("tiene exactamente 2 objetos: die-line + nombre de la tienda", () => {
    const project = createKraftHandmadeEtsyProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "shop-name"]);
  });

  it("reutiliza exactamente la paleta/fill kraft de Etiqueta Kraft Genérica (#F5EFE3 / #2B2216) — DEC-009", () => {
    const project = createKraftHandmadeEtsyProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    const shopName = objects.find((o) => o.metadata.role === "shop-name");
    expect(dieLine?.style.fill).toBe("#F5EFE3");
    expect(shopName?.style.fill).toBe("#2B2216");
  });

  it("usa Lora, mismo rol tipográfico que Kraft Genérica", () => {
    const project = createKraftHandmadeEtsyProject({ now: NOW, generateId });
    const shopName = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "shop-name");
    expect(shopName?.type === "text" && shopName.fontFamily).toBe("Lora");
  });
});
