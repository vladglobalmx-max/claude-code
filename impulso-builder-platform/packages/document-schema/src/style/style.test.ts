import { describe, expect, it } from "vitest";
import { StyleSchema } from "./style.js";

describe("StyleSchema", () => {
  it("aplica defaults: strokeWidth 0, opacity 1, blendMode normal", () => {
    const style = StyleSchema.parse({});
    expect(style.strokeWidth).toBe(0);
    expect(style.opacity).toBe(1);
    expect(style.blendMode).toBe("normal");
    expect(style.fill).toBeUndefined();
  });

  it("acepta fill/stroke y shadow completos", () => {
    const style = StyleSchema.parse({
      fill: "#ff0000",
      stroke: "#000000",
      strokeWidth: 2,
      opacity: 0.8,
      blendMode: "multiply",
      shadow: { color: "#000000", blur: 4, offsetX: 2, offsetY: 2 },
    });
    expect(style.shadow).toEqual({ color: "#000000", blur: 4, offsetX: 2, offsetY: 2 });
  });

  it("rechaza opacity fuera de [0,1]", () => {
    expect(() => StyleSchema.parse({ opacity: 1.5 })).toThrow();
    expect(() => StyleSchema.parse({ opacity: -0.1 })).toThrow();
  });

  it("rechaza blendMode fuera del enum", () => {
    expect(() => StyleSchema.parse({ blendMode: "hue" })).toThrow();
  });

  it("rechaza un color vacío", () => {
    expect(() => StyleSchema.parse({ fill: "" })).toThrow();
  });
});
