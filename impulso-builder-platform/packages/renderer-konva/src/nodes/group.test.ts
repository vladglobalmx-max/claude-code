import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createGroupNode } from "./group.js";
import { buildGroup, buildRectangle } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

describe("createGroupNode", () => {
  it("crea un Konva.Group vacío cuando no hay hijos", () => {
    const object = buildGroup("g1", []);
    const node = createGroupNode(object, context, () => new Konva.Rect());
    expect(node).toBeInstanceOf(Konva.Group);
    expect(node.getChildren()).toHaveLength(0);
  });

  it("delega la creación de cada hijo a createChildNode y los agrega en orden", () => {
    const child1 = buildRectangle("c1");
    const child2 = buildRectangle("c2");
    const object = buildGroup("g1", [child1, child2]);
    const createChildNode = vi.fn((child) => {
      const rect = new Konva.Rect();
      rect.id(child.id);
      return rect;
    });

    const node = createGroupNode(object, context, createChildNode);

    expect(createChildNode).toHaveBeenCalledTimes(2);
    expect(node.getChildren().map((n) => n.id())).toEqual(["c1", "c2"]);
  });
});
