import { describe, expect, it } from "vitest";
import { componer } from "./componer.js";
import { exportarSVG } from "./exportar.js";

describe("exportarSVG", () => {
  it("produce un SVG real (vía @impulso/export-engine, sin tocarlo) que contiene el contenido del usuario", async () => {
    const doc = componer({
      content: "Marcela & Andrés",
      fontFamily: "Georgia",
      fontSize: 24,
      textColor: "#7d3520",
      shapeColor: "#ecd3ab",
      archetype: "circle",
    });

    const svg = await exportarSVG(doc);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("Marcela &amp; Andrés"); // escapado XML del "&" real del contenido
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("#ecd3ab");
  });

  it("el arquetipo 'rectangle' exporta un <rect>, no un <ellipse>", async () => {
    const doc = componer({
      content: "Rafael Ferretería",
      fontFamily: "Arial",
      fontSize: 20,
      textColor: "#ffffff",
      shapeColor: "#1c1917",
      archetype: "rectangle",
    });

    const svg = await exportarSVG(doc);

    expect(svg).toContain("<rect");
    expect(svg).not.toContain("<ellipse");
    expect(svg).toContain("Rafael Ferrete");
  });
});
