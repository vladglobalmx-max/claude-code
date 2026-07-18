import { describe, expect, it } from "vitest";
import { rectangleMarkup, ellipseMarkup, pathMarkup } from "./shapeMarkup.js";
import { buildRectangle, buildEllipse, buildPath } from "../testUtils/fixtures.js";

describe("shapeMarkup", () => {
  it("rectangleMarkup: rect en el origen local con width/height/rx", () => {
    const object = buildRectangle("r1", { size: { width: 10, height: 20 }, cornerRadius: 3 });
    expect(rectangleMarkup(object)).toBe('<rect x="0" y="0" width="10" height="20" rx="3"/>');
  });

  it("ellipseMarkup: ellipse centrada en el origen local (el transform ya trasladó al centro)", () => {
    const object = buildEllipse("e1", { size: { width: 40, height: 10 } });
    expect(ellipseMarkup(object)).toBe('<ellipse cx="0" cy="0" rx="20" ry="5"/>');
  });

  it("pathMarkup: usa segmentsToSvgPathData y escapa el atributo d", () => {
    const object = buildPath("p1", {
      segments: [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 5, y: 5 } },
      ],
      closed: false,
    });
    expect(pathMarkup(object)).toBe('<path d="M 0 0 L 5 5"/>');
  });
});
