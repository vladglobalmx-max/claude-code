import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createTextNode } from "./text.js";
import { buildText } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

describe("createTextNode", () => {
  it("mapea content/fontFamily/fontSize/align/lineHeight", () => {
    const object = buildText("t1", {
      content: "Impulso",
      fontFamily: "Inter",
      fontSize: 18,
      textAlign: "center",
      lineHeight: 1.5,
    });
    const node = createTextNode(object, context);

    expect(node).toBeInstanceOf(Konva.Text);
    expect(node.text()).toBe("Impulso");
    expect(node.fontFamily()).toBe("Inter");
    expect(node.fontSize()).toBe(18);
    expect(node.align()).toBe("center");
    expect(node.lineHeight()).toBe(1.5);
  });

  it("fontWeight >= 700 se traduce a fontStyle 'bold'", () => {
    const object = buildText("t1", { fontWeight: 700 });
    const node = createTextNode(object, context);
    expect(node.fontStyle()).toBe("bold");
  });

  it("fontWeight < 700 se traduce a fontStyle 'normal'", () => {
    const object = buildText("t1", { fontWeight: 400 });
    const node = createTextNode(object, context);
    expect(node.fontStyle()).toBe("normal");
  });

  it("fill del style es el color del texto", () => {
    const object = buildText("t1", { style: { fill: "#123456", strokeWidth: 0, opacity: 1, blendMode: "normal" } });
    const node = createTextNode(object, context);
    expect(node.fill()).toBe("#123456");
  });

  it("sin size, no se fuerza un ancho/alto fijo (Konva usa su propio auto-tamaño)", () => {
    const object = buildText("t1");
    const node = createTextNode(object, context);
    expect(object.size).toBeUndefined();
    // Konva.Text sin width/height explícitos devuelve 0 (su propio default,
    // no "undefined") — el punto que importa es que NO forzamos un tamaño.
    expect(node.width()).toBe(0);
  });

  it("con size, se usa como caja de ajuste (word wrap)", () => {
    const object = buildText("t1", { size: { width: 120, height: 60 } });
    const node = createTextNode(object, context);
    expect(node.width()).toBe(120);
    expect(node.height()).toBe(60);
  });
});
