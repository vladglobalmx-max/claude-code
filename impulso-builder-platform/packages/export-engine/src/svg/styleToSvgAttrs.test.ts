import { describe, expect, it } from "vitest";
import { styleToSvgAttrs } from "./styleToSvgAttrs.js";

const baseStyle = { strokeWidth: 0, opacity: 1, blendMode: "normal" as const };

describe("styleToSvgAttrs", () => {
  it("sin fill, exporta fill=none (SVG por defecto pintaría negro)", () => {
    const result = styleToSvgAttrs(baseStyle, "obj1", { includePaint: true });
    expect(result.presentationAttrs).toContain('fill="none"');
  });

  it("con fill/stroke/strokeWidth, los incluye", () => {
    const result = styleToSvgAttrs({ ...baseStyle, fill: "#ff0000", stroke: "#000000", strokeWidth: 2 }, "obj1", {
      includePaint: true,
    });
    expect(result.presentationAttrs).toContain('fill="#ff0000"');
    expect(result.presentationAttrs).toContain('stroke="#000000"');
    expect(result.presentationAttrs).toContain('stroke-width="2"');
  });

  it("opacity !== 1 se incluye; opacity === 1 se omite", () => {
    expect(styleToSvgAttrs({ ...baseStyle, opacity: 0.5 }, "o", { includePaint: true }).presentationAttrs).toContain(
      'opacity="0.5"',
    );
    expect(styleToSvgAttrs(baseStyle, "o", { includePaint: true }).presentationAttrs).not.toContain("opacity");
  });

  it("blendMode !== normal se traduce a mix-blend-mode vía style=", () => {
    const result = styleToSvgAttrs({ ...baseStyle, blendMode: "multiply" }, "o", { includePaint: true });
    expect(result.presentationAttrs).toContain("mix-blend-mode:multiply");
  });

  it("blendMode normal no agrega ningún style=", () => {
    const result = styleToSvgAttrs(baseStyle, "o", { includePaint: true });
    expect(result.presentationAttrs).not.toContain("style=");
  });

  it("shadow produce un filterDef con feDropShadow y lo referencia en style=", () => {
    const result = styleToSvgAttrs(
      { ...baseStyle, shadow: { color: "#000000", blur: 4, offsetX: 2, offsetY: 3 } },
      "obj1",
      { includePaint: true },
    );
    expect(result.filterDef).toContain("feDropShadow");
    expect(result.filterDef).toContain('dx="2"');
    expect(result.filterDef).toContain('dy="3"');
    expect(result.filterDef).toContain('stdDeviation="2"');
    expect(result.presentationAttrs).toContain("filter:url(#shadow-obj1)");
  });

  it("includePaint:false (Group) omite fill/stroke/shadow pero conserva opacity/blendMode", () => {
    const result = styleToSvgAttrs(
      { ...baseStyle, fill: "#ff0000", opacity: 0.5, blendMode: "screen", shadow: { color: "#000", blur: 2, offsetX: 0, offsetY: 0 } },
      "obj1",
      { includePaint: false },
    );
    expect(result.presentationAttrs).not.toContain("fill=");
    expect(result.presentationAttrs).not.toContain("stroke");
    expect(result.filterDef).toBeUndefined();
    expect(result.presentationAttrs).toContain('opacity="0.5"');
    expect(result.presentationAttrs).toContain("mix-blend-mode:screen");
  });
});
