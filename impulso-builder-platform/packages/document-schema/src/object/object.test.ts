import { describe, expect, it } from "vitest";
import { SceneObjectSchema } from "./object.js";
import { ObjectIdSchema, AssetIdSchema } from "../primitives/identifiers.js";

const NOW = "2026-07-17T00:00:00.000Z";

function baseFields(id: string) {
  return {
    id: ObjectIdSchema.parse(id),
    transform: { x: 0, y: 0 },
    style: {},
    metadata: { createdAt: NOW, updatedAt: NOW },
    pluginData: {},
    customProperties: {},
  };
}

describe("SceneObjectSchema — tipos base", () => {
  it("valida un rectangle con cornerRadius por defecto", () => {
    const rectangle = SceneObjectSchema.parse({
      ...baseFields("obj_rect"),
      type: "rectangle",
      size: { width: 100, height: 50 },
    });
    expect(rectangle).toMatchObject({ type: "rectangle", cornerRadius: 0 });
  });

  it("valida un ellipse", () => {
    const ellipse = SceneObjectSchema.parse({
      ...baseFields("obj_ellipse"),
      type: "ellipse",
      size: { width: 40, height: 40 },
    });
    expect(ellipse.type).toBe("ellipse");
  });

  it("valida un path cerrado con segmentos mixtos", () => {
    const path = SceneObjectSchema.parse({
      ...baseFields("obj_path"),
      type: "path",
      closed: true,
      segments: [
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 10, y: 0 } },
        {
          type: "cubicCurveTo",
          control1: { x: 15, y: 0 },
          control2: { x: 15, y: 10 },
          point: { x: 10, y: 10 },
        },
        { type: "close" },
      ],
    });
    expect(path.type).toBe("path");
    if (path.type === "path") {
      expect(path.segments).toHaveLength(4);
    }
  });

  it("rechaza un path sin segmentos", () => {
    expect(() =>
      SceneObjectSchema.parse({
        ...baseFields("obj_path_empty"),
        type: "path",
        segments: [],
      }),
    ).toThrow();
  });

  it("valida un image que referencia un assetId", () => {
    const image = SceneObjectSchema.parse({
      ...baseFields("obj_image"),
      type: "image",
      assetId: AssetIdSchema.parse("asset_1"),
      size: { width: 200, height: 200 },
    });
    expect(image.type).toBe("image");
  });

  it("valida un text con defaults de fontWeight/textAlign/lineHeight", () => {
    const text = SceneObjectSchema.parse({
      ...baseFields("obj_text"),
      type: "text",
      content: "Impulso",
      fontFamily: "Inter",
      fontSize: 24,
    });
    expect(text).toMatchObject({
      type: "text",
      fontWeight: 400,
      textAlign: "left",
      lineHeight: 1.2,
    });
  });

  it("rechaza un discriminante 'type' desconocido", () => {
    expect(() =>
      SceneObjectSchema.parse({
        ...baseFields("obj_unknown"),
        type: "triangle",
      }),
    ).toThrow();
  });
});

describe("SceneObjectSchema — group recursivo", () => {
  it("valida un group con hijos de distintos tipos", () => {
    const group = SceneObjectSchema.parse({
      ...baseFields("obj_group"),
      type: "group",
      children: [
        {
          ...baseFields("obj_child_rect"),
          type: "rectangle",
          size: { width: 10, height: 10 },
        },
        {
          ...baseFields("obj_child_text"),
          type: "text",
          content: "hola",
          fontFamily: "Inter",
          fontSize: 12,
        },
      ],
    });
    expect(group.type).toBe("group");
    if (group.type === "group") {
      expect(group.children).toHaveLength(2);
    }
  });

  it("valida un group anidado tres niveles de profundidad (group dentro de group dentro de group)", () => {
    const deep = {
      ...baseFields("level0"),
      type: "group",
      children: [
        {
          ...baseFields("level1"),
          type: "group",
          children: [
            {
              ...baseFields("level2"),
              type: "group",
              children: [
                {
                  ...baseFields("level3_leaf"),
                  type: "rectangle",
                  size: { width: 1, height: 1 },
                  cornerRadius: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    const parsed = SceneObjectSchema.parse(deep);
    expect(parsed.type).toBe("group");
    if (parsed.type === "group") {
      const level1 = parsed.children[0];
      expect(level1?.type).toBe("group");
      if (level1?.type === "group") {
        const level2 = level1.children[0];
        expect(level2?.type).toBe("group");
        if (level2?.type === "group") {
          expect(level2.children[0]?.type).toBe("rectangle");
        }
      }
    }
  });

  it("rechaza un group cuyo hijo es inválido (rectangle con size negativo)", () => {
    expect(() =>
      SceneObjectSchema.parse({
        ...baseFields("obj_group_invalid"),
        type: "group",
        children: [
          {
            ...baseFields("obj_child_invalid"),
            type: "rectangle",
            size: { width: -1, height: 10 },
          },
        ],
      }),
    ).toThrow();
  });
});
