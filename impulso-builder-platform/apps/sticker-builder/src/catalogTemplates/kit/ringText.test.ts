import { describe, expect, it } from "vitest";
import { createIdFactory } from "./ids.js";
import { arrangeRingText } from "./ringText.js";

const NOW = "2026-07-28T00:00:00.000Z";
function ids() {
  let n = 0;
  return createIdFactory(() => `id${++n}`);
}

function fragment(content: string, width?: number) {
  return {
    content,
    fontFamily: "Work Sans",
    fontSize: 8,
    fill: "#2B2224",
    role: "ring-text",
    name: content,
    width,
  };
}

describe("arrangeRingText", () => {
  it("ubica el primer fragmento arriba (φ=-90°, default) como caja horizontal normal centrada arriba del círculo", () => {
    const obj = arrangeRingText({
      ids: ids(),
      now: NOW,
      centerX: 100,
      centerY: 100,
      radius: 50,
      fragments: [fragment("SALÓN", 40)],
    })[0]!;

    expect(obj.transform.x).toBeCloseTo(100 - 20, 6);
    expect(obj.transform.y).toBeCloseTo(100 - 50, 6);
    expect(obj.transform.rotation).toBeCloseTo(0, 6);
  });

  it("ubica un fragmento a la derecha (φ=0°) rotado 90°, extendiéndose hacia el centro", () => {
    const obj = arrangeRingText({
      ids: ids(),
      now: NOW,
      centerX: 100,
      centerY: 100,
      radius: 50,
      startAngleDeg: 0,
      fragments: [fragment("MARINA", 40)],
    })[0]!;

    expect(obj.transform.x).toBeCloseTo(150, 6);
    expect(obj.transform.y).toBeCloseTo(100 - 20, 6);
    expect(obj.transform.rotation).toBeCloseTo(90, 6);
  });

  it("distribuye N fragmentos en ángulos igualmente espaciados (360/N) a partir de startAngleDeg", () => {
    const objs = arrangeRingText({
      ids: ids(),
      now: NOW,
      centerX: 0,
      centerY: 0,
      radius: 50,
      startAngleDeg: -90,
      fragments: [fragment("A", 10), fragment("B", 10), fragment("C", 10), fragment("D", 10)],
    });

    // Para 4 fragmentos, paso = 90°; rotación = φ+90 → -90+90=0, 0+90=90, 90+90=180, 180+90=270
    expect(objs.map((o) => o.transform.rotation)).toEqual([0, 90, 180, 270]);
  });

  it("cada fragmento conserva su propio contenido, fill y role — nunca se fusionan", () => {
    const objs = arrangeRingText({
      ids: ids(),
      now: NOW,
      centerX: 0,
      centerY: 0,
      radius: 50,
      fragments: [fragment("SALÓN", 40), fragment("MARINA", 40)],
    });

    expect(objs[0]!.content).toBe("SALÓN");
    expect(objs[1]!.content).toBe("MARINA");
    expect(objs[0]!.id).not.toBe(objs[1]!.id);
  });

  it("estima el ancho de forma generosa (content.length * fontSize) cuando no se especifica, para evitar word-wrap invisible", () => {
    const obj = arrangeRingText({
      ids: ids(),
      now: NOW,
      centerX: 0,
      centerY: 0,
      radius: 50,
      fragments: [fragment("MARINA")],
    })[0]!;

    expect(obj.size!.width).toBeCloseTo("MARINA".length * 8, 6);
  });
});
