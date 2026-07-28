import { describe, expect, it } from "vitest";
import { validateProject } from "@impulso/document-schema";
import { createSerumFacialPremiumProject } from "./serumFacialPremium.js";

const NOW = "2026-07-19T00:00:00.000Z";
let idCounter = 0;
const generateId = () => `id-${++idCounter}`;

describe("createSerumFacialPremiumProject", () => {
  it("produce un Project válido contra el schema de @impulso/document-schema", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    expect(() => validateProject(project)).not.toThrow();
  });

  it("usa el troquel circular de 40mm especificado en TEMPLATE_BATCH_02.md", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const page = project.document.pages[0]!;
    expect(page.size).toEqual({ width: 40, height: 40 });
    expect(page.unit).toBe("mm");
  });

  it("incluye la línea de corte como ellipse con role die-line", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const dieLine = objects.find((o) => o.metadata.role === "die-line");
    expect(dieLine?.type).toBe("ellipse");
  });

  it("tiene exactamente 6 objetos: die-line + wordmark + nombre + línea + % activo + volumen", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects).toHaveLength(6);
    expect(objects.map((o) => o.metadata.role)).toEqual([
      "die-line",
      "wordmark",
      "product-name",
      "divider",
      "active-percentage",
      "volume",
    ]);
  });

  it("no incluye ningún ImageObject — el batch declara 'Assets necesarios: Ninguno'", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    expect(objects.some((o) => o.type === "image")).toBe(false);
    expect(project.document.assets).toEqual([]);
  });

  it("usa la paleta real del batch: carbón #23282B para texto/línea, cobre #9C4E27 solo en el % de activo", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const activePercentage = objects.find((o) => o.metadata.role === "active-percentage");
    const wordmark = objects.find((o) => o.metadata.role === "wordmark");
    const volume = objects.find((o) => o.metadata.role === "volume");

    expect(activePercentage?.style.fill).toBe("#9C4E27");
    expect(wordmark?.style.fill).toBe("#23282B");
    expect(volume?.style.fill).toBe("#23282B");
  });

  it("usa Poppins (no Century Gothic) como familia tipográfica — decisión de licenciamiento libre", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const textObjects = objects.filter((o) => o.type === "text");
    expect(textObjects.length).toBeGreaterThan(0);
    for (const obj of textObjects) {
      if (obj.type === "text") expect(obj.fontFamily).toBe("Poppins");
    }
  });

  it("el wordmark usa peso 300 (dominante) y el resto del texto usa peso 400, según la jerarquía del batch", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const wordmark = objects.find((o) => o.metadata.role === "wordmark");
    const productName = objects.find((o) => o.metadata.role === "product-name");

    expect(wordmark?.type === "text" && wordmark.fontWeight).toBe(300);
    expect(productName?.type === "text" && productName.fontWeight).toBe(400);
  });

  it("la línea divisoria no excede el 40% del diámetro del círculo (Layout del batch)", () => {
    const project = createSerumFacialPremiumProject({ now: NOW, generateId });
    const objects = project.document.pages[0]!.layers[0]!.objects;
    const divider = objects.find((o) => o.metadata.role === "divider");
    expect(divider?.type).toBe("rectangle");
    if (divider?.type === "rectangle") {
      // 40mm -> px vía toPixels; el diámetro real en px de la línea de
      // corte es el ancho/alto del objeto ellipse.
      const dieLine = objects.find((o) => o.metadata.role === "die-line");
      const diameterPx = dieLine?.type === "ellipse" ? dieLine.size.width : 0;
      expect(divider.size.width).toBeLessThanOrEqual(diameterPx * 0.4);
    }
  });

  it("genera ids frescos en cada llamada (nunca reutiliza los de una instancia anterior)", () => {
    const first = createSerumFacialPremiumProject({ now: NOW, generateId });
    const second = createSerumFacialPremiumProject({ now: NOW, generateId });
    expect(first.id).not.toBe(second.id);
    expect(first.document.id).not.toBe(second.document.id);
  });
});
