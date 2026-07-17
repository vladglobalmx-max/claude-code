import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createImageNode } from "./image.js";
import { buildImage } from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

describe("createImageNode", () => {
  it("sin resolveAssetSource, se dibuja como placeholder (dash + stroke)", () => {
    const object = buildImage("img1", { size: { width: 30, height: 30 } });
    const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

    const node = createImageNode(object, context);

    expect(node).toBeInstanceOf(Konva.Image);
    expect(node.image()).toBeUndefined();
    expect(node.dash()).toEqual([4, 4]);
    expect(node.stroke()).toBe("#999999");
  });

  it("usa el stroke del style si está definido, en vez del gris por defecto", () => {
    const object = buildImage("img1", { style: { stroke: "#ff0000", strokeWidth: 2, opacity: 1, blendMode: "normal" } });
    const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

    const node = createImageNode(object, context);

    expect(node.stroke()).toBe("#ff0000");
    expect(node.strokeWidth()).toBe(2);
  });

  it("con resolveAssetSource, usa la fuente resuelta y no aplica el placeholder", () => {
    const fakeSource = {} as CanvasImageSource;
    const object = buildImage("img1");
    const context: NodeContext = {
      dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never,
      resolveAssetSource: vi.fn().mockReturnValue(fakeSource),
    };

    const node = createImageNode(object, context);

    expect(node.image()).toBe(fakeSource);
    expect(node.dash()).toBeUndefined();
  });
});
