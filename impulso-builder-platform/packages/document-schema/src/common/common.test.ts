import { describe, expect, it } from "vitest";
import { MetadataSchema } from "./metadata.js";
import { PluginDataSchema } from "./pluginData.js";
import { CustomPropertiesSchema } from "./customProperties.js";

const NOW = "2026-07-17T00:00:00.000Z";

describe("MetadataSchema", () => {
  it("aplica defaults: tags [], visible true, locked false", () => {
    const metadata = MetadataSchema.parse({ createdAt: NOW, updatedAt: NOW });
    expect(metadata.tags).toEqual([]);
    expect(metadata.visible).toBe(true);
    expect(metadata.locked).toBe(false);
  });

  it("acepta name/description/role/tags explícitos", () => {
    const metadata = MetadataSchema.parse({
      name: "Sticker de gato",
      description: "Diseño para catálogo de primavera",
      role: "die-line",
      tags: ["gato", "primavera"],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(metadata.name).toBe("Sticker de gato");
    expect(metadata.role).toBe("die-line");
    expect(metadata.tags).toEqual(["gato", "primavera"]);
  });

  it("rechaza createdAt/updatedAt que no sean datetime ISO", () => {
    expect(() =>
      MetadataSchema.parse({ createdAt: "no-es-una-fecha", updatedAt: NOW }),
    ).toThrow();
  });
});

describe("PluginDataSchema", () => {
  it("acepta payloads arbitrarios por clave de plugin", () => {
    const pluginData = PluginDataSchema.parse({
      "sticker-builder": { dieCutMarginMm: 3 },
    });
    expect(pluginData["sticker-builder"]).toEqual({ dieCutMarginMm: 3 });
  });

  it("por defecto es un objeto vacío", () => {
    expect(PluginDataSchema.parse(undefined)).toEqual({});
  });
});

describe("CustomPropertiesSchema", () => {
  it("acepta valores JSON arbitrarios", () => {
    const props = CustomPropertiesSchema.parse({ internalRef: "ABC-123", priority: 2 });
    expect(props).toEqual({ internalRef: "ABC-123", priority: 2 });
  });

  it("rechaza valores no serializables (ej. una función)", () => {
    expect(() => CustomPropertiesSchema.parse({ callback: () => {} })).toThrow();
  });
});
