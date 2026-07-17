import { describe, expect, it, vi } from "vitest";
import Konva from "konva";
import { createSceneNode } from "./sceneNode.js";
import {
  buildRectangle,
  buildEllipse,
  buildPath,
  buildImage,
  buildText,
  buildGroup,
} from "../testUtils/fixtures.js";
import type { NodeContext } from "../types.js";

const context: NodeContext = { dispatch: vi.fn().mockReturnValue({ ok: true, value: {} }) as never };

describe("createSceneNode — dispatcher de los 6 tipos de Object", () => {
  it("rectangle -> Konva.Rect", () => {
    expect(createSceneNode(buildRectangle("r"), context)).toBeInstanceOf(Konva.Rect);
  });

  it("ellipse -> Konva.Ellipse", () => {
    expect(createSceneNode(buildEllipse("e"), context)).toBeInstanceOf(Konva.Ellipse);
  });

  it("path -> Konva.Path", () => {
    expect(createSceneNode(buildPath("p"), context)).toBeInstanceOf(Konva.Path);
  });

  it("image -> Konva.Image", () => {
    expect(createSceneNode(buildImage("i"), context)).toBeInstanceOf(Konva.Image);
  });

  it("text -> Konva.Text", () => {
    expect(createSceneNode(buildText("t"), context)).toBeInstanceOf(Konva.Text);
  });

  it("group -> Konva.Group, recursivamente para sus hijos de cualquier tipo", () => {
    const group = buildGroup("g", [buildRectangle("child_rect"), buildEllipse("child_ellipse")]);
    const node = createSceneNode(group, context);

    expect(node).toBeInstanceOf(Konva.Group);
    if (node instanceof Konva.Group) {
      const children = node.getChildren();
      expect(children).toHaveLength(2);
      expect(children[0]).toBeInstanceOf(Konva.Rect);
      expect(children[1]).toBeInstanceOf(Konva.Ellipse);
    }
  });

  it("group anidado varios niveles se resuelve recursivamente", () => {
    const deep = buildGroup("outer", [buildGroup("inner", [buildRectangle("leaf")])]);
    const node = createSceneNode(deep, context);
    expect(node).toBeInstanceOf(Konva.Group);
    if (node instanceof Konva.Group) {
      const inner = node.getChildren()[0];
      expect(inner).toBeInstanceOf(Konva.Group);
      if (inner instanceof Konva.Group) {
        expect(inner.getChildren()[0]).toBeInstanceOf(Konva.Rect);
      }
    }
  });
});
