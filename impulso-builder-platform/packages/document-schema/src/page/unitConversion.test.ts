import { describe, expect, it } from "vitest";
import { toPixels, fromPixels } from "./unitConversion.js";

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

describe("fromPixels", () => {
  it("px se devuelve sin cambios", () => {
    expect(fromPixels(100, "px")).toBe(100);
  });

  it("in es la inversa de toPixels", () => {
    expect(fromPixels(96, "in")).toBeCloseTo(1, 5);
    expect(fromPixels(192, "in")).toBeCloseTo(2, 5);
  });

  it("mm es la inversa de toPixels", () => {
    expect(fromPixels(96, "mm")).toBeCloseTo(25.4, 5);
  });

  it("es la inversa exacta de toPixels para cualquier unidad (round-trip)", () => {
    for (const unit of ["px", "in", "mm"] as const) {
      expect(fromPixels(toPixels(37.5, unit), unit)).toBeCloseTo(37.5, 9);
    }
  });
});
