import { describe, expect, it } from "vitest";
import { segmentsToSvgPathData } from "./pathData.js";

describe("segmentsToSvgPathData", () => {
  it("traduce moveTo/lineTo a M/L", () => {
    const data = segmentsToSvgPathData(
      [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 5 } },
      ],
      false,
    );
    expect(data).toBe("M 0 0 L 10 5");
  });

  it("traduce quadraticCurveTo a Q y cubicCurveTo a C", () => {
    const data = segmentsToSvgPathData(
      [
        { type: "quadraticCurveTo", control: { x: 1, y: 2 }, point: { x: 3, y: 4 } },
        {
          type: "cubicCurveTo",
          control1: { x: 5, y: 6 },
          control2: { x: 7, y: 8 },
          point: { x: 9, y: 10 },
        },
      ],
      false,
    );
    expect(data).toBe("Q 1 2 3 4 C 5 6 7 8 9 10");
  });

  it("un segmento 'close' se traduce a Z", () => {
    const data = segmentsToSvgPathData([{ type: "moveTo", point: { x: 0, y: 0 } }, { type: "close" }], false);
    expect(data).toBe("M 0 0 Z");
  });

  it("closed=true agrega Z si no hay ya un segmento close explícito", () => {
    const data = segmentsToSvgPathData([{ type: "moveTo", point: { x: 0, y: 0 } }], true);
    expect(data).toBe("M 0 0 Z");
  });

  it("closed=true no duplica Z si ya hay un segmento close explícito", () => {
    const data = segmentsToSvgPathData([{ type: "moveTo", point: { x: 0, y: 0 } }, { type: "close" }], true);
    expect(data).toBe("M 0 0 Z");
  });
});
