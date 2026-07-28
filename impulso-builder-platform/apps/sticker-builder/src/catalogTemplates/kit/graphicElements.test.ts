import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids.js";
import { createRectangle, createEllipse, createDividerLine } from "./graphicElements.js";

const NOW = "2026-07-28T00:00:00.000Z";
function ids() {
  let n = 0;
  return createIdFactory(() => `id${++n}`);
}

describe("createRectangle", () => {
  it("produce un RectangleObject con los defaults de estilo (strokeWidth 0, opacity 1, cornerRadius 0)", () => {
    const rect = createRectangle({ ids: ids(), now: NOW, x: 1, y: 2, width: 30, height: 5, fill: "#000" });
    expect(rect.type).toBe("rectangle");
    expect(rect.style.strokeWidth).toBe(0);
    expect(rect.style.opacity).toBe(1);
    expect(rect.cornerRadius).toBe(0);
    expect(rect.transform).toEqual({ x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it("respeta role/name/opacity/stroke explícitos", () => {
    const rect = createRectangle({ ids: ids(), now: NOW, x: 0, y: 0, width: 1, height: 1, opacity: 0.35, stroke: "#ccc", role: "divider", name: "n" });
    expect(rect.style.opacity).toBe(0.35);
    expect(rect.style.stroke).toBe("#ccc");
    expect(rect.metadata.role).toBe("divider");
  });
});

describe("createEllipse", () => {
  it("produce un EllipseObject posicionado y con estilo por defecto (opacity 1, strokeWidth 0)", () => {
    const ellipse = createEllipse({ ids: ids(), now: NOW, x: 0, y: 0, width: 151.18, height: 151.18 });
    expect(ellipse.type).toBe("ellipse");
    expect(ellipse.size).toEqual({ width: 151.18, height: 151.18 });
    expect(ellipse.style.strokeWidth).toBe(0);
  });
});

describe("createDividerLine", () => {
  it("centra la línea horizontalmente sobre centerX (transform.x = centerX - width/2)", () => {
    const divider = createDividerLine({ ids: ids(), now: NOW, centerX: 75.59, y: 100, width: 45, color: "#23282B" });
    expect(divider.transform.x).toBeCloseTo(75.59 - 22.5, 6);
    expect(divider.size.width).toBe(45);
  });

  it("usa thickness como height, con default 1px cuando no se especifica", () => {
    const withThickness = createDividerLine({ ids: ids(), now: NOW, centerX: 0, y: 0, width: 10, thickness: 0.8, color: "#000" });
    expect(withThickness.size.height).toBe(0.8);

    const withDefault = createDividerLine({ ids: ids(), now: NOW, centerX: 0, y: 0, width: 10, color: "#000" });
    expect(withDefault.size.height).toBe(1);
  });

  it("role/name por defecto son 'divider'/'Línea divisoria' salvo override", () => {
    const divider = createDividerLine({ ids: ids(), now: NOW, centerX: 0, y: 0, width: 10, color: "#000" });
    expect(divider.metadata.role).toBe("divider");
    expect(divider.metadata.name).toBe("Línea divisoria");
  });
});
