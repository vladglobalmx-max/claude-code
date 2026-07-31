import { RectangleObjectSchema, TextObjectSchema, EllipseObjectSchema } from "@impulso/document-schema";
import { describe, expect, it } from "vitest";
import { nextObjectId } from "../ids.js";
import { contentObjects, findCollisions, worldAabb } from "./collision.js";

const NOW = "2026-07-30T00:00:00.000Z";
const metadata = (role?: string) => ({ createdAt: NOW, updatedAt: NOW, role });

function rect(x: number, y: number, width: number, height: number, opts: { rotation?: number; fill?: string; role?: string } = {}) {
  return RectangleObjectSchema.parse({
    id: nextObjectId(),
    type: "rectangle",
    size: { width, height },
    transform: { x, y, rotation: opts.rotation ?? 0 },
    style: { fill: opts.fill ?? "#000000" },
    metadata: metadata(opts.role),
  });
}

function textObj(x: number, y: number, width: number, height: number, opts: { fill?: string; role?: string } = {}) {
  return TextObjectSchema.parse({
    id: nextObjectId(),
    type: "text",
    content: "x",
    fontFamily: "Arial",
    fontSize: 12,
    size: { width, height },
    transform: { x, y },
    style: { fill: opts.fill ?? "#000000" },
    metadata: metadata(opts.role),
  });
}

function outlineEllipse(centerX: number, centerY: number, diameter: number) {
  return EllipseObjectSchema.parse({
    id: nextObjectId(),
    type: "ellipse",
    size: { width: diameter, height: diameter },
    transform: { x: centerX - diameter / 2, y: centerY - diameter / 2 },
    style: { stroke: "#000000", strokeWidth: 1 },
    metadata: metadata("ornamento"),
  });
}

describe("worldAabb", () => {
  it("sin rotación, coincide con x/y/width/height", () => {
    const box = worldAabb(rect(10, 20, 100, 50));
    expect(box).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it("con rotación de 90°, el ancho y el alto se intercambian (pivote top-left)", () => {
    const box = worldAabb(rect(10, 20, 100, 50, { rotation: 90 }));
    // (0,0)->(10,20); (100,0)->(10,120); (100,50)->(-40,120); (0,50)->(-40,20)
    expect(box.minX).toBeCloseTo(-40);
    expect(box.maxX).toBeCloseTo(10);
    expect(box.minY).toBeCloseTo(20);
    expect(box.maxY).toBeCloseTo(120);
  });

  it("para Ellipse, usa el rectángulo que la circunscribe alrededor de su centro", () => {
    const box = worldAabb(outlineEllipse(100, 100, 60));
    expect(box).toEqual({ minX: 70, minY: 70, maxX: 130, maxY: 130 });
  });
});

describe("contentObjects", () => {
  it("excluye objetos sin fill (contornos) y objetos con role 'background'", () => {
    const objects = [
      rect(0, 0, 260, 260, { role: "background" }),
      outlineEllipse(130, 130, 172), // sin fill, solo stroke
      textObj(10, 10, 50, 20),
    ];
    expect(contentObjects(objects)).toEqual([objects[2]]);
  });
});

describe("findCollisions", () => {
  it("no reporta nada cuando el contenido no se superpone", () => {
    const objects = [textObj(0, 0, 50, 20), textObj(100, 100, 50, 20)];
    expect(findCollisions(objects)).toHaveLength(0);
  });

  it("detecta la superposición de dos objetos de contenido", () => {
    const objects = [textObj(0, 0, 50, 20), textObj(10, 10, 50, 20)];
    expect(findCollisions(objects)).toHaveLength(1);
  });

  it("nunca marca colisión entre contenido y un contorno decorativo que lo rodea (sin fill)", () => {
    const guide = outlineEllipse(100, 100, 200); // círculo hueco grande
    const inside = textObj(80, 90, 40, 20); // vive dentro del área que delimita el círculo
    expect(findCollisions([guide, inside])).toHaveLength(0);
  });

  it("nunca marca colisión entre contenido y el fondo de página", () => {
    const background = rect(0, 0, 260, 260, { role: "background" });
    const content = textObj(10, 10, 50, 20);
    expect(findCollisions([background, content])).toHaveLength(0);
  });
});
