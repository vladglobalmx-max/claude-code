import { describe, expect, it } from "vitest";
import { toPixels } from "@impulso/document-schema";
import { createIdFactory } from "./ids.js";
import { createDieLineObjects } from "./dieLine.js";

const NOW = "2026-07-28T00:00:00.000Z";
function ids() {
  let n = 0;
  return createIdFactory(() => `id${++n}`);
}

describe("createDieLineObjects", () => {
  it("shape 'circle' produce exactamente un EllipseObject con role 'die-line', en px canónico", () => {
    const objects = createDieLineObjects({ ids: ids(), now: NOW, shape: "circle", widthMm: 40, heightMm: 40 });
    expect(objects).toHaveLength(1);
    expect(objects[0]?.type).toBe("ellipse");
    expect(objects[0]?.metadata.role).toBe("die-line");
    if (objects[0]?.type === "ellipse") {
      expect(objects[0].size).toEqual({ width: toPixels(40, "mm"), height: toPixels(40, "mm") });
    }
  });

  it.each(["square", "rectangle", "custom"] as const)("shape '%s' no produce ningún objeto", (shape) => {
    const objects = createDieLineObjects({ ids: ids(), now: NOW, shape, widthMm: 50, heightMm: 50 });
    expect(objects).toEqual([]);
  });

  it("respeta fill/stroke/strokeWidth por defecto cuando no se pasan (compatibilidad hacia atrás)", () => {
    const objects = createDieLineObjects({ ids: ids(), now: NOW, shape: "circle", widthMm: 40, heightMm: 40 });
    const dieLine = objects[0];
    if (dieLine?.type === "ellipse") {
      expect(dieLine.style.fill).toBe("#ffffff");
      expect(dieLine.style.stroke).toBe("#cccccc");
      expect(dieLine.style.strokeWidth).toBe(0.5);
    }
  });

  it("acepta fill/stroke/strokeWidth explícitos (DEC-009 — aproximación de textura kraft como color sólido)", () => {
    const objects = createDieLineObjects({ ids: ids(), now: NOW, shape: "circle", widthMm: 45, heightMm: 45, fill: "#F5EFE3", stroke: "#8B6F47", strokeWidth: 0.4 });
    const dieLine = objects[0];
    if (dieLine?.type === "ellipse") {
      expect(dieLine.style.fill).toBe("#F5EFE3");
      expect(dieLine.style.stroke).toBe("#8B6F47");
      expect(dieLine.style.strokeWidth).toBe(0.4);
    }
  });
});
