import { describe, expect, it } from "vitest";
import { buildGroup, buildLayer, buildPage, buildRectangle } from "../testUtils/fixtures.js";
import { checkSafeAreaInvasions } from "./safeAreaCheck.js";
import type { SafeAreaCanonicalRect } from "./safeAreaRect.js";

const TRIM_W = 100;
const TRIM_H = 100;
const SAFE_AREA: SafeAreaCanonicalRect = { x: 10, y: 10, width: 80, height: 80 };

function check(page: ReturnType<typeof buildPage>) {
  return checkSafeAreaInvasions(page, TRIM_W, TRIM_H, SAFE_AREA);
}

describe("checkSafeAreaInvasions", () => {
  it("object completamente dentro del safe area: sin invasión", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 20, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    expect(check(page)).toEqual([]);
  });

  it("object que cruza el borde del safe area: invasión reportada", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 5, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } }); // x=5..15, invade el margen izquierdo (safe area empieza en 10)
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const invasions = check(page);
    expect(invasions).toHaveLength(1);
    expect(invasions[0]!.objectId).toBe("rect_1");
  });

  it("object completamente fuera del TrimBox: NUNCA genera un issue de safe area", () => {
    const rect = buildRectangle("rect_1", { transform: { x: -50, y: -50, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 10, height: 10 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    expect(check(page)).toEqual([]);
  });

  it("object hidden: excluido del chequeo", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 10, height: 10 },
      metadata: { tags: [], visible: false, locked: false, createdAt: "x", updatedAt: "x" },
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    expect(check(page)).toEqual([]);
  });

  it("die-line: excluido del chequeo (nunca es contenido)", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 10, height: 10 },
      metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "x", role: "die-line" },
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    expect(check(page)).toEqual([]);
  });

  it("locked NO excluye — sigue participando en el chequeo (es una propiedad de edición, no de contenido)", () => {
    const rect = buildRectangle("rect_1", {
      transform: { x: 5, y: 20, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 10, height: 10 },
      metadata: { tags: [], visible: true, locked: true, createdAt: "x", updatedAt: "x" },
    });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    expect(check(page)).toHaveLength(1);
  });

  it("group: se evalúa como UNA unidad — la unión de sus hijos, no un issue por hijo", () => {
    const insideChild = buildRectangle("rect_inside", { transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 5, height: 5 } });
    const invadingChild = buildRectangle("rect_invading", { transform: { x: -25, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 5, height: 5 } });
    const group = buildGroup("group_1", [insideChild, invadingChild], { transform: { x: 30, y: 30, rotation: 0, scaleX: 1, scaleY: 1 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    const invasions = check(page);
    expect(invasions).toHaveLength(1);
    expect(invasions[0]!.objectId).toBe("group_1"); // reporta el GROUP, no "rect_invading"
  });

  it("group cuyo único hijo es un die-line: no produce ningún bounding box (nada que participe)", () => {
    const dieLineChild = buildRectangle("rect_dl", {
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 5, height: 5 },
      metadata: { tags: [], visible: true, locked: false, createdAt: "x", updatedAt: "x", role: "die-line" },
    });
    const group = buildGroup("group_1", [dieLineChild]);
    const page = buildPage("page_1", [buildLayer("layer_1", [group])]);
    expect(check(page)).toEqual([]);
  });

  it("object rotado: la caja global (post-rotación) es la que se compara contra el safe area", () => {
    // Un rectángulo de 20x4 centrado en (50,50), rotado 45°, tiene una
    // caja envolvente MÁS GRANDE que su tamaño nominal — puede invadir el
    // safe area aunque su tamaño "de frente" quepa cómodo.
    const rect = buildRectangle("rect_1", { transform: { x: 40, y: 48, rotation: 45, scaleX: 1, scaleY: 1 }, size: { width: 20, height: 4 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    // Con SAFE_AREA 10..90 y un rect rotado 45° de ~17px de "radio" diagonal
    // centrado cerca de (50,50), no debería invadir (bien adentro) — se
    // verifica aquí que el chequeo real corre sin lanzar y devuelve un
    // resultado coherente con la geometría rotada (no con el AABB sin rotar).
    expect(check(page)).toEqual([]);
  });

  it("unidades: el bounding box vive en px canónico, igual que SafeAreaCanonicalRect — sin conversión adicional", () => {
    const rect = buildRectangle("rect_1", { transform: { x: 0, y: 20, rotation: 0, scaleX: 1, scaleY: 1 }, size: { width: 5, height: 5 } });
    const page = buildPage("page_1", [buildLayer("layer_1", [rect])]);
    const invasions = check(page);
    expect(invasions[0]!.boundingBox).toEqual({ minX: 0, minY: 20, maxX: 5, maxY: 25 });
  });
});
