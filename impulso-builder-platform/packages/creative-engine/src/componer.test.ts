import { describe, expect, it } from "vitest";
import { componer } from "./componer.js";

const baseParams = {
  content: "Marcela & Andrés",
  fontFamily: "Georgia",
  fontSize: 24,
  textColor: "#7d3520",
  shapeColor: "#ecd3ab",
} as const;

describe("componer", () => {
  it("rechaza contenido vacío — el Motor Creativo nunca compone sobre nada", () => {
    expect(() => componer({ ...baseParams, content: "   ", archetype: "circle" })).toThrow();
  });

  it("produce un Document con una sola página y dos objects (forma + texto)", () => {
    const doc = componer({ ...baseParams, archetype: "circle" });
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]!.layers).toHaveLength(1);
    expect(doc.pages[0]!.layers[0]!.objects).toHaveLength(2);
  });

  it("arquetipo 'circle' produce un EllipseObject posicionado por su esquina superior izquierda, igual que el rectángulo", () => {
    const doc = componer({ ...baseParams, archetype: "circle", pageSize: 200 });
    const shape = doc.pages[0]!.layers[0]!.objects[0]!;
    expect(shape.type).toBe("ellipse");
    if (shape.type !== "ellipse") throw new Error("unreachable");
    expect(shape.size.width).toBe(shape.size.height);
    // transform.x/y es la esquina superior izquierda a nivel de schema para
    // todo tipo, Ellipse incluido (ver comentario en componer.ts) — 90% de
    // 200 = 180, centrado en una página de 200 -> esquina en (10,10).
    expect(shape.transform.x).toBeCloseTo(10);
    expect(shape.transform.y).toBeCloseTo(10);
    expect(shape.style.fill).toBe(baseParams.shapeColor);
  });

  it("arquetipo 'rectangle' produce un RectangleObject posicionado por su esquina superior izquierda", () => {
    const doc = componer({ ...baseParams, archetype: "rectangle", pageSize: 200 });
    const shape = doc.pages[0]!.layers[0]!.objects[0]!;
    expect(shape.type).toBe("rectangle");
    if (shape.type !== "rectangle") throw new Error("unreachable");
    // Rectangle ocupa 90% de la página (180 de 200), centrado -> esquina en (10,10).
    expect(shape.size.width).toBeCloseTo(180);
    expect(shape.transform.x).toBeCloseTo(10);
    expect(shape.transform.y).toBeCloseTo(10);
  });

  it("el TextObject siempre está centrado (textAlign 'center') y conserva el contenido real", () => {
    const doc = componer({ ...baseParams, archetype: "circle" });
    const text = doc.pages[0]!.layers[0]!.objects[1]!;
    expect(text.type).toBe("text");
    if (text.type !== "text") throw new Error("unreachable");
    expect(text.content).toBe("Marcela & Andrés");
    expect(text.textAlign).toBe("center");
    expect(text.style.fill).toBe(baseParams.textColor);
    expect(text.size).toBeDefined(); // sin caja, @impulso/document-schema no puede centrar el texto
  });

  it("la caja del texto queda centrada en la página independientemente del arquetipo de la forma", () => {
    const circleDoc = componer({ ...baseParams, archetype: "circle", pageSize: 240 });
    const rectDoc = componer({ ...baseParams, archetype: "rectangle", pageSize: 240 });
    const circleText = circleDoc.pages[0]!.layers[0]!.objects[1]!;
    const rectText = rectDoc.pages[0]!.layers[0]!.objects[1]!;
    if (circleText.type !== "text" || rectText.type !== "text") throw new Error("unreachable");
    const circleCenterX = circleText.transform.x + circleText.size!.width / 2;
    const rectCenterX = rectText.transform.x + rectText.size!.width / 2;
    expect(circleCenterX).toBeCloseTo(120);
    expect(rectCenterX).toBeCloseTo(120);
  });

  it("aplica valores por defecto de peso tipográfico, interlineado y tamaño de página cuando no se especifican", () => {
    const doc = componer({ ...baseParams, archetype: "rectangle" });
    const text = doc.pages[0]!.layers[0]!.objects[1]!;
    if (text.type !== "text") throw new Error("unreachable");
    expect(text.fontWeight).toBe(600);
    expect(text.lineHeight).toBe(1.2);
    expect(doc.pages[0]!.size).toEqual({ width: 240, height: 240 });
  });

  it("respeta parámetros explícitos de peso, interlineado y tamaño de página", () => {
    const doc = componer({
      ...baseParams,
      archetype: "rectangle",
      fontWeight: 700,
      lineHeight: 1.5,
      pageSize: 300,
    });
    const text = doc.pages[0]!.layers[0]!.objects[1]!;
    if (text.type !== "text") throw new Error("unreachable");
    expect(text.fontWeight).toBe(700);
    expect(text.lineHeight).toBe(1.5);
    expect(doc.pages[0]!.size).toEqual({ width: 300, height: 300 });
  });
});
