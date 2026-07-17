import { describe, expect, it } from "vitest";
import { toKonvaXY, fromKonvaXY } from "./coordinates.js";
import { buildRectangle, buildEllipse } from "./testUtils/fixtures.js";

describe("toKonvaXY", () => {
  it("para rectangle (y la mayoría de tipos) es idéntico a transform.x/y", () => {
    const object = buildRectangle("r", { transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } });
    expect(toKonvaXY(object)).toEqual({ x: 10, y: 20 });
  });

  it("para ellipse suma la mitad del tamaño (Konva posiciona por el centro)", () => {
    const object = buildEllipse("e", {
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 40, height: 10 },
    });
    expect(toKonvaXY(object)).toEqual({ x: 30, y: 25 });
  });
});

describe("fromKonvaXY", () => {
  it("para rectangle es idéntico a las coordenadas de Konva", () => {
    const object = buildRectangle("r");
    expect(fromKonvaXY(object, 5, 7)).toEqual({ x: 5, y: 7 });
  });

  it("para ellipse resta la mitad del tamaño (inverso de toKonvaXY)", () => {
    const object = buildEllipse("e", { size: { width: 40, height: 10 } });
    expect(fromKonvaXY(object, 30, 25)).toEqual({ x: 10, y: 20 });
  });

  it("toKonvaXY y fromKonvaXY son inversas entre sí para ellipse", () => {
    const object = buildEllipse("e", {
      transform: { x: 3, y: 8, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 16, height: 6 },
    });
    const konvaPos = toKonvaXY(object);
    expect(fromKonvaXY(object, konvaPos.x, konvaPos.y)).toEqual({ x: 3, y: 8 });
  });
});
