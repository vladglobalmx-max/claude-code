import { describe, expect, it } from "vitest";
import Konva from "konva";
import { toCanvasBlendMode, applyShapeStyle } from "./style.js";

describe("toCanvasBlendMode", () => {
  it("traduce 'normal' a 'source-over' (el valor real del Canvas 2D API)", () => {
    expect(toCanvasBlendMode("normal")).toBe("source-over");
  });

  it("el resto de los blend modes pasan sin cambios", () => {
    expect(toCanvasBlendMode("multiply")).toBe("multiply");
    expect(toCanvasBlendMode("screen")).toBe("screen");
    expect(toCanvasBlendMode("overlay")).toBe("overlay");
    expect(toCanvasBlendMode("darken")).toBe("darken");
    expect(toCanvasBlendMode("lighten")).toBe("lighten");
  });
});

describe("applyShapeStyle", () => {
  it("aplica fill/stroke/strokeWidth", () => {
    const rect = new Konva.Rect();
    applyShapeStyle(rect, { fill: "#ff0000", stroke: "#000000", strokeWidth: 2, opacity: 1, blendMode: "normal" });
    expect(rect.fill()).toBe("#ff0000");
    expect(rect.stroke()).toBe("#000000");
    expect(rect.strokeWidth()).toBe(2);
  });

  it("no toca fill/stroke si no vienen en el style (quedan undefined)", () => {
    const rect = new Konva.Rect();
    applyShapeStyle(rect, { strokeWidth: 0, opacity: 1, blendMode: "normal" });
    expect(rect.fill()).toBeUndefined();
    expect(rect.stroke()).toBeUndefined();
  });

  it("aplica shadow cuando está presente", () => {
    const rect = new Konva.Rect();
    applyShapeStyle(rect, {
      strokeWidth: 0,
      opacity: 1,
      blendMode: "normal",
      shadow: { color: "#333333", blur: 4, offsetX: 1, offsetY: 2 },
    });
    expect(rect.shadowColor()).toBe("#333333");
    expect(rect.shadowBlur()).toBe(4);
    expect(rect.shadowOffsetX()).toBe(1);
    expect(rect.shadowOffsetY()).toBe(2);
  });

  it("no aplica shadow si no está presente", () => {
    const rect = new Konva.Rect();
    applyShapeStyle(rect, { strokeWidth: 0, opacity: 1, blendMode: "normal" });
    expect(rect.shadowColor()).toBeUndefined();
  });
});
