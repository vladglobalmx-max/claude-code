import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createThankYouPreferenceProject } from "./thankYouPreference.js";

const NOW = "2026-07-28T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createThankYouPreferenceProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 35mm especificado en TEMPLATE_BATCH_07.md", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.size).toEqual({ width: 35, height: 35 });
  });

  it("tiene exactamente 2 objetos: die-line + texto de agradecimiento (un solo nivel, sin línea divisoria)", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.map((o) => o.metadata.role)).toEqual(["die-line", "thank-you-text"]);
  });

  it("usa Playfair Display, una tipografía serif libre (sin riesgo de licencia)", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    const text = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "thank-you-text");
    expect(text?.type === "text" && text.fontFamily).toBe("Playfair Display");
  });

  it("el contenido del texto coincide con el ejemplo literal del batch", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    const text = project.document.pages[0]!.layers[0]!.objects.find((o) => o.metadata.role === "thank-you-text");
    expect(text?.type === "text" && text.content).toBe("Gracias por su preferencia");
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createThankYouPreferenceProject({ now: NOW, generateId });
    expect(project.document.pages[0]!.layers[0]!.objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });
});
