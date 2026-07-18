import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { rotateObject } from "./rotateObjectCommand.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

function projectWithRect() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
  });
}

describe("rotateObject", () => {
  it("delega en computeRotatedTransform y commitea la rotación resultante", () => {
    const result = rotateObject(projectWithRect(), {
      type: "rotateObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      pointerAngleDegrees: 45,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 45, scaleX: 1, scaleY: 1 });
    }
  });

  it("normaliza ángulos negativos antes de commitear", () => {
    const result = rotateObject(projectWithRect(), {
      type: "rotateObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      pointerAngleDegrees: -90,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.rotation).toBe(270);
    }
  });

  it("respeta snapToIncrement", () => {
    const result = rotateObject(projectWithRect(), {
      type: "rotateObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      pointerAngleDegrees: 41,
      snapToIncrement: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.rotation).toBe(45);
    }
  });

  it("no modifica x/y/scaleX/scaleY, solo rotation", () => {
    const result = rotateObject(
      buildProject({
        document: buildDocument([
          buildPage("page_1", [
            buildLayer("layer_1", [
              buildRectangle("rect_1", { transform: { x: 12, y: 34, rotation: 0, scaleX: 2, scaleY: 3 } }),
            ]),
          ]),
        ]),
      }),
      {
        type: "rotateObject",
        objectId: ObjectIdSchema.parse("rect_1"),
        pointerAngleDegrees: 90,
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 12, y: 34, rotation: 90, scaleX: 2, scaleY: 3 });
    }
  });

  it("rechaza un objectId inexistente", () => {
    const result = rotateObject(projectWithRect(), {
      type: "rotateObject",
      objectId: ObjectIdSchema.parse("no_existe"),
      pointerAngleDegrees: 45,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });
});
