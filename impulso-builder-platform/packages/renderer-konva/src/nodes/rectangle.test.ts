import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createRectangleNode } from "./rectangle.js";
import { buildRectangle } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

describe("createRectangleNode", () => {
  it("crea un Konva.Rect con size, cornerRadius, style y transform", () => {
    const object = buildRectangle("r1", {
      size: { width: 40, height: 20 },
      cornerRadius: 4,
      style: { fill: "#00ff00", strokeWidth: 1, opacity: 1, blendMode: "normal" },
    });
    const node = createRectangleNode(object, context);

    expect(node).toBeInstanceOf(Konva.Rect);
    expect(node.width()).toBe(40);
    expect(node.height()).toBe(20);
    expect(node.cornerRadius()).toBe(4);
    expect(node.fill()).toBe("#00ff00");
    expect(node.id()).toBe("r1");
  });
});
