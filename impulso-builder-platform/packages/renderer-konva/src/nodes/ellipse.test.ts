import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createEllipseNode } from "./ellipse.js";
import { buildEllipse } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

describe("createEllipseNode", () => {
  it("crea un Konva.Ellipse con radiusX/radiusY derivados de size", () => {
    const object = buildEllipse("e1", { size: { width: 40, height: 20 } });
    const node = createEllipseNode(object, context);

    expect(node).toBeInstanceOf(Konva.Ellipse);
    expect(node.radiusX()).toBe(20);
    expect(node.radiusY()).toBe(10);
  });
});
