import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createEtsyNeutralPackagingProject } from "./etsyNeutralPackaging.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createEtsyNeutralPackagingProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el formato cuadrado de 40mm especificado en TEMPLATE_BATCH_10.md", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 40, height: 40 });
  });

  it("tiene exactamente 2 objetos: espacio de logo (placeholder) + línea de agradecimiento", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["user-logo-placeholder", "thank-you-line"]);
  });

  it("el placeholder de logo es un RectangleObject sin relleno (solo borde) — no es contenido de THÖREN", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    const placeholder = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "user-logo-placeholder");
    expect(placeholder?.type).toBe("rectangle");
    expect(placeholder?.style.fill).toBeUndefined();
    expect(placeholder?.style.stroke).toBeTruthy();
  });

  it("no incluye ningún ImageObject ni asset real — el placeholder es geometría, nunca un asset embebido", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("el acento cobre (#9C4E27) se usa únicamente en el borde del placeholder, nunca en el texto", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const placeholder = objects.find((o) => o.metadata.role === "user-logo-placeholder");
    const thankYou = objects.find((o) => o.metadata.role === "thank-you-line");
    expect(placeholder?.style.stroke).toBe("#9C4E27");
    expect(thankYou?.style.fill).not.toBe("#9C4E27");
  });

  it("la línea de agradecimiento queda por debajo del placeholder de logo (retícula 66/34)", () => {
    const project = createEtsyNeutralPackagingProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const placeholder = objects.find((o) => o.metadata.role === "user-logo-placeholder")!;
    const thankYou = objects.find((o) => o.metadata.role === "thank-you-line")!;
    expect(thankYou.transform.y).toBeGreaterThan(placeholder.transform.y);
  });
});
