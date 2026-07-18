import { describe, expect, it } from "vitest";
import { transformToSvgAttr } from "./transformToSvgAttr.js";
import { buildRectangle, buildEllipse } from "../testUtils/fixtures.js";

describe("transformToSvgAttr", () => {
  it("rectángulo: translate usa x/y tal cual (esquina superior izquierda)", () => {
    const object = buildRectangle("r1", { transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 } });
    expect(transformToSvgAttr(object)).toBe("translate(10 20) rotate(0) scale(1 1)");
  });

  it("ellipse: translate usa el CENTRO (x + width/2, y + height/2)", () => {
    const object = buildEllipse("e1", {
      transform: { x: 10, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 40, height: 10 },
    });
    expect(transformToSvgAttr(object)).toBe("translate(30 25) rotate(0) scale(1 1)");
  });

  it("incluye rotation y scale", () => {
    const object = buildRectangle("r2", { transform: { x: 0, y: 0, rotation: 45, scaleX: 2, scaleY: 3 } });
    expect(transformToSvgAttr(object)).toBe("translate(0 0) rotate(45) scale(2 3)");
  });
});
