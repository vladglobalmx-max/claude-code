import { describe, expect, it } from "vitest";
import { ObjectIdSchema } from "@impulso/document-schema";
import { resizeObject } from "./resizeObjectCommand.js";
import { buildProject, buildDocument, buildPage, buildLayer, buildRectangle } from "../testUtils/fixtures.js";

function projectWithRect() {
  return buildProject({
    document: buildDocument([buildPage("page_1", [buildLayer("layer_1", [buildRectangle("rect_1")])])]),
  });
}

describe("resizeObject", () => {
  it("delega en computeResizedTransform y commitea el Transform resultante", () => {
    // rect_1 (fixture): transform {x:0,y:0,rotation:0,scaleX:1,scaleY:1}, size 10x10.
    const result = resizeObject(projectWithRect(), {
      type: "resizeObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      handle: "bottom-right",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1.5, scaleY: 1.5 });
    }
  });

  it("el anclaje se refleja correctamente en el Transform commiteado (top-left)", () => {
    const result = resizeObject(projectWithRect(), {
      type: "resizeObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      handle: "top-left",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform).toEqual({ x: 5, y: 5, rotation: 0, scaleX: 0.5, scaleY: 0.5 });
    }
  });

  it("respeta maintainAspectRatio", () => {
    const result = resizeObject(projectWithRect(), {
      type: "resizeObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      handle: "right",
      pointerDelta: { x: 10, y: 0 },
      intrinsicSize: { width: 10, height: 10 },
      maintainAspectRatio: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object?.transform.scaleX).toBeCloseTo(2, 10);
      expect(object?.transform.scaleY).toBeCloseTo(2, 10);
    }
  });

  it("rechaza un objectId inexistente", () => {
    const result = resizeObject(projectWithRect(), {
      type: "resizeObject",
      objectId: ObjectIdSchema.parse("no_existe"),
      handle: "bottom-right",
      pointerDelta: { x: 5, y: 5 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("object_not_found");
  });

  it("nunca produce un tamaño por debajo de MIN_RESIZE_SIZE", () => {
    const result = resizeObject(projectWithRect(), {
      type: "resizeObject",
      objectId: ObjectIdSchema.parse("rect_1"),
      handle: "bottom-right",
      pointerDelta: { x: -50, y: -50 },
      intrinsicSize: { width: 10, height: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const object = result.value.document.pages[0]?.layers[0]?.objects[0];
      expect(object!.transform.scaleX * 10).toBeGreaterThanOrEqual(1);
      expect(object!.transform.scaleY * 10).toBeGreaterThanOrEqual(1);
    }
  });
});
