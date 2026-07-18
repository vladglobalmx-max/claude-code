import { describe, expect, it } from "vitest";
import { toPixels } from "./unitConversion.js";

describe("toPixels", () => {
  it("px se devuelve sin cambios", () => {
    expect(toPixels(100, "px")).toBe(100);
  });

  it("in se convierte a 96px por pulgada", () => {
    expect(toPixels(1, "in")).toBe(96);
    expect(toPixels(2, "in")).toBe(192);
  });

  it("mm se convierte vía 96px/25.4mm por pulgada", () => {
    expect(toPixels(25.4, "mm")).toBeCloseTo(96, 5);
    expect(toPixels(10, "mm")).toBeCloseTo(37.7952755906, 5);
  });
});
