import { describe, expect, it } from "vitest";
import { PointSchema, SizeSchema, RectSchema, TransformSchema } from "./geometry.js";

describe("PointSchema", () => {
  it("acepta coordenadas negativas y decimales", () => {
    expect(PointSchema.parse({ x: -10.5, y: 3 })).toEqual({ x: -10.5, y: 3 });
  });

  it("rechaza campos faltantes", () => {
    expect(() => PointSchema.parse({ x: 1 })).toThrow();
  });
});

describe("SizeSchema", () => {
  it("acepta dimensiones no negativas", () => {
    expect(SizeSchema.parse({ width: 100, height: 0 })).toEqual({ width: 100, height: 0 });
  });

  it("rechaza dimensiones negativas", () => {
    expect(() => SizeSchema.parse({ width: -1, height: 10 })).toThrow();
  });
});

describe("RectSchema", () => {
  it("acepta posición negativa con dimensiones no negativas", () => {
    expect(RectSchema.parse({ x: -5, y: -5, width: 10, height: 10 })).toEqual({
      x: -5,
      y: -5,
      width: 10,
      height: 10,
    });
  });
});

describe("TransformSchema", () => {
  it("aplica defaults (rotation 0, scale 1) cuando solo se da x/y", () => {
    expect(TransformSchema.parse({ x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("respeta valores explícitos por encima de los defaults", () => {
    const transform = TransformSchema.parse({
      x: 0,
      y: 0,
      rotation: 45,
      scaleX: 2,
      scaleY: 0.5,
    });
    expect(transform.rotation).toBe(45);
    expect(transform.scaleX).toBe(2);
    expect(transform.scaleY).toBe(0.5);
  });
});
