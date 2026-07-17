import { describe, expect, it } from "vitest";
import { LayerSchema } from "./layer.js";
import { LayerIdSchema, ObjectIdSchema } from "../primitives/identifiers.js";

const NOW = "2026-07-17T00:00:00.000Z";

describe("LayerSchema", () => {
  it("acepta una layer vacía con defaults", () => {
    const layer = LayerSchema.parse({
      id: LayerIdSchema.parse("layer_1"),
      metadata: { createdAt: NOW, updatedAt: NOW },
    });
    expect(layer.objects).toEqual([]);
    expect(layer.pluginData).toEqual({});
    expect(layer.customProperties).toEqual({});
  });

  it("acepta una layer con objects mixtos", () => {
    const layer = LayerSchema.parse({
      id: LayerIdSchema.parse("layer_2"),
      metadata: { createdAt: NOW, updatedAt: NOW },
      objects: [
        {
          id: ObjectIdSchema.parse("obj_1"),
          type: "rectangle",
          transform: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
          style: {},
          metadata: { createdAt: NOW, updatedAt: NOW },
          pluginData: {},
          customProperties: {},
        },
      ],
    });
    expect(layer.objects).toHaveLength(1);
  });

  it("rechaza un object inválido dentro de la layer", () => {
    expect(() =>
      LayerSchema.parse({
        id: LayerIdSchema.parse("layer_3"),
        metadata: { createdAt: NOW, updatedAt: NOW },
        objects: [{ type: "rectangle" }],
      }),
    ).toThrow();
  });
});
